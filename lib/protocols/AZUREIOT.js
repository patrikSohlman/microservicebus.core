/*
The MIT License (MIT)

Copyright (c) 2014 microServiceBus.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

'use strict';
//var AmqpWs; // Default transport for Receiver
var ReceiveClient;
var SendClient;
var SharedAccessSignature;
var Message;

var url = require("url");
var crypto = require('crypto');
var httpRequest = require('request');
var storage = require('node-persist');
var util = require('../Utils.js');
var guid = require('uuid');

function AZUREIOT(nodeName, sbSettings) {
    var me = this;
    var stop = false;
    var storageIsEnabled = true;
    var sender;
    var receiver;
    var twin;
    var tracker;
    var tokenRefreshTimer;
    var tokenRefreshInterval = (sbSettings.tokenLifeTime * 60 * 1000) * 0.9;

    var protocolType = "MQTT-WS";
    
    // Setup tracking
    var baseAddress = "https://" + sbSettings.sbNamespace;
    if (!baseAddress.match(/\/$/)) {
        baseAddress += '/';
    }
    var restTrackingToken = sbSettings.trackingToken;

    AZUREIOT.prototype.Start = function (callback) {
        me = this;
        stop = false;

        util.addNpmPackages("azure-iot-device,azure-iot-device-mqtt,azure-iothub", false, function (err) {
            if (err)
                me.onQueueErrorReceiveCallback("AZURE IoT: Unable to download Azure IoT npm packages");
            else {
                //var DeviceProtocol = require('azure-iot-device-mqtt').Mqtt;
                ReceiveClient = require('azure-iot-device').Client;
                SendClient = require('azure-iothub').Client;
                SharedAccessSignature = require('azure-iot-device').SharedAccessSignature;
                Message = require('azure-iot-device').Message;

                var DeviceProtocol = require('azure-iot-device-mqtt').MqttWs; // Default transport for Receiver
                var ServiceProtocol = require('azure-iothub').AmqpWs; // Default transport for Receiver

                if (!sender)
                    sender = SendClient.fromSharedAccessSignature(sbSettings.senderToken, ServiceProtocol);
                if (!receiver)
                    receiver = ReceiveClient.fromSharedAccessSignature(sbSettings.receiverToken, DeviceProtocol);

                sender.open(function (err) {
                    var self = me;
                    if (err) {
                        me.onQueueErrorReceiveCallback('AZURE IoT: Unable to connect to Azure IoT Hub (send) : ' + err);
                    }
                    else {
                        me.onQueueDebugCallback("Sender is ready");
                        receiver.open(function (err, transport) {
                            if (err) {
                                me.onQueueErrorReceiveCallback('AZURE IoT: Could not connect: ' + err);
                            }
                            else {
                                me.onQueueDebugCallback("AZURE IoT: Receiver is ready");

                                receiver.on('message', function (msg) {
                                    try {
                                        var message = msg.data;

                                        var isAction = msg.properties.propertyList.find(function (p) { return p.key === "msbaction" });

                                        if (isAction) {
                                            receiver.complete(msg, function () { });
                                            me.onActionCallback(message);
                                            return;
                                        }
                                        else {
                                            var responseData = {
                                                body: message,
                                                applicationProperties: { value: { service: message.service } }
                                            }
                                            me.onQueueMessageReceivedCallback(responseData);
                                            receiver.complete(msg, function () { });
                                        }
                                    }
                                    catch (e) {
                                        me.onQueueErrorReceiveCallback('AZURE IoT: Could not connect: ' + e.message);
                                    }
                                });
                                if (protocolType === "MQTT" || protocolType === "MQTT-WS") {
                                    receiver.getTwin(function (err, twin) {
                                        if (err) {
                                            me.onQueueErrorReceiveCallback('AZURE IoT: Could not get twin: ' + err);
                                        } else {
                                            me.twin = twin;
                                            me.onQueueDebugCallback("AZURE IoT: Device twin is ready");
                                            twin.on('properties.desired', function (desiredChange) {
                                                // Incoming state
                                                me.onQueueDebugCallback("AZURE IoT: Received new state");
                                                var state = JSON.stringify(desiredChange);
                                                me.onStateReceivedCallback(state);
                                            });
                                            if (callback != null)
                                                callback();
                                        }
                                    });
                                }
                                else {
                                    if (callback != null)
                                        callback();
                                }
                            }
                        });
                    }
                });

                tokenRefreshTimer = setInterval(function () {
                    me.onQueueDebugCallback("Update tracking tokens");
                    acquireToken("AZUREIOT", "TRACKING", restTrackingToken, function (token) {
                        if (token == null) {
                            me.onQueueErrorSubmitCallback("Unable to aquire tracking token: " + token);
                        }
                        else {
                            restTrackingToken = token;
                        }
                    });
                }, tokenRefreshInterval);
            }
        });


    };
    AZUREIOT.prototype.ChangeState = function (message, node) {
        me.onQueueDebugCallback("AZURE IoT: device state is changed");
        if (!twin) {
            me.onQueueErrorSubmitCallback('AZURE IoT: Device twin not registered');
            return;
        }
        me.twin.properties.reported.update(message, function (err) {
            if (err) {
                me.onQueueErrorReceiveCallback('AZURE IoT: Could not update twin: ' + err.message);
            } else {
                me.onQueueDebugCallback("AZURE IoT: twin state reported");
            }
        });

    };
    AZUREIOT.prototype.Stop = function () {
        stop = true;
        clearTimeout(tokenRefreshTimer);
        if (sender) {
            sender.close(function () {
                receiver.close(function () {
                    me.onQueueDebugCallback("AZURE IoT: Stopped");
                });
            });
        }
    };
    AZUREIOT.prototype.Submit = function (message, node, service) {
        var me = this;
        if (stop) {
            var persistMessage = {
                node: node,
                service: service,
                message: message
            };
            if (storageIsEnabled)
                storage.setItem(guid.v1(), persistMessage);

            return;
        }
        message.service = service;

        sender.send(node, message, function (err) {
            if (err)
                me.onQueueErrorReceiveCallback(err);
        });
    };
    AZUREIOT.prototype.Track = function (trackingMessage) {
        try {
            var me = this;
            if (stop) {
                if (storageIsEnabled)
                    storage.setItem("_tracking_" + trackingMessage.InterchangeId, trackingMessage);

                return;
            }

            var trackUri = baseAddress + sbSettings.trackingHubName + "/messages" + "?timeout=60";

            httpRequest({
                headers: {
                    "Authorization": restTrackingToken,
                    "Content-Type": "application/json",
                },
                uri: trackUri,
                json: trackingMessage,
                method: 'POST'
            },
                function (err, res, body) {
                    if (err != null) {
                        me.onQueueErrorSubmitCallback("Unable to send message. " + err.code + " - " + err.message)
                        console.log("Unable to send message. " + err.code + " - " + err.message);
                        if (storageIsEnabled)
                            storage.setItem("_tracking_" + trackingMessage.InterchangeId, trackingMessage);
                    }
                    else if (res.statusCode >= 200 && res.statusCode < 300) {
                    }
                    else if (res.statusCode == 401) {
                        console.log("Invalid token. Updating token...")

                        //acquireToken("MICROSERVICEBUS", "TRACKING", restTrackingToken, function (token) {
                        //    if (token == null && storageIsEnabled) {
                        //        me.onQueueErrorSubmitCallback("Unable to aquire tracking token: " + token);
                        //        storage.setItem("_tracking_" + trackingMessage.InterchangeId, trackingMessage);
                        //        return;
                        //    }

                        //    restTrackingToken = token;
                        //    me.Track(trackingMessage);
                        //});
                        return;
                    }
                    else {
                        console.log("Unable to send message. " + res.statusCode + " - " + res.statusMessage);

                    }
                });

        }
        catch (err) {
            console.log();
        }
    };
    AZUREIOT.prototype.Update = function (settings) {
        restTrackingToken = settings.trackingToken;
        me.onQueueDebugCallback("Tracking token updated");
    };

    function acquireToken(provider, keyType, oldKey, callback) {
        try {
            var acquireTokenUri = me.hubUri.replace("wss:", "https:") + "/api/Token";
            var request = {
                "provider": provider,
                "keyType": keyType,
                "oldKey": oldKey
            }
            httpRequest({
                headers: {
                    "Content-Type": "application/json",
                },
                uri: acquireTokenUri,
                json: request,
                method: 'POST'
            },
                function (err, res, body) {
                    if (err != null) {
                        me.onQueueErrorSubmitCallback("Unable to acquire new token. " + err.message);
                        callback(null);
                    }
                    else if (res.statusCode >= 200 && res.statusCode < 300) {
                        callback(body.token);
                    }
                    else {
                        me.onQueueErrorSubmitCallback("Unable to acquire new token. Status code: " + res.statusCode);
                        callback(null);
                    }
                });
        }
        catch (err) {
            process.exit(1);
        }
    };
}
module.exports = AZUREIOT;

