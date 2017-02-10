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
const path = require('path');
const fs = require('fs');
var httpRequest = require('request');
var storage = require('node-persist');
var util = require('../Utils.js');

function AWSIOT(nodeName, sbSettings) {
    var me = this;
    var stop = false;
    var storageIsEnabled = true;
    var awsIot;
    var thingShadow;
    // Setup tracking
    var baseAddress = "https://" + sbSettings.sbNamespace;
    if (!baseAddress.match(/\/$/)) {
        baseAddress += '/';
    }
    var restTrackingToken = sbSettings.trackingToken;

    AWSIOT.prototype.Start = function (callback) {
        me = this;
        stop = false;
        me.onQueueDebugCallback("AWS device is starting");
        util.addNpmPackages("aws-iot-device-sdk", false, function (err) {
            if (err)
                me.onQueueErrorReceiveCallback("Unable to download AWS IoT npm package");
            else {
                awsIot = require("aws-iot-device-sdk");
                var certDir = './cert/';//path.normalize('./cert/');
                var data = fs.readFileSync(certDir + nodeName + '.settings', 'utf8');
                var settings = JSON.parse(data);

                if (!thingShadow) {
                    thingShadow = awsIot.thingShadow({
                        keyPath: certDir + nodeName + '.private.key',
                        certPath: certDir + nodeName + '.cert.pem',
                        caPath: certDir + 'root-CA.crt',
                        clientId: nodeName,
                        region: settings.region
                    });

                    thingShadow.register(nodeName, {
                        persistentSubscribe: true,
                        ignoreDeltas: false
                    });

                    thingShadow.on("connect", function () {
                        me.onQueueDebugCallback("AWS device is ready");

                        thingShadow.subscribe(nodeName, function (error, result) {
                            me.onQueueDebugCallback("AWS device is subscribing to " + nodeName);
                            callback();
                        });
                    });
                    thingShadow.on('close', function () {
                        me.onQueueDebugCallback("AWS device is closed");
                        thingShadow.unregister(nodeName);
                    });
                    thingShadow.on('reconnect', function () {
                        me.onQueueDebugCallback("AWS device is reconnecting");
                    });
                    thingShadow.on('offline', function () {
                        me.onQueueDebugCallback("AWS device is offline");
                    });
                    thingShadow.on('error', function (error) {
                        me.onQueueErrorReceiveCallback("AWS error: " + error);
                    });
                    thingShadow.on("message", function (topic, msg) {

                        try {
                            var json = msg.toString();
                            var message = JSON.parse(json);

                            var responseData = {
                                body: message,
                                applicationProperties: { value: { service: message.service } }
                            }
                            me.onQueueMessageReceivedCallback(responseData);

                        }
                        catch (e) {
                            me.onQueueErrorReceiveCallback('Error receiving the message: ' + e.message);
                        }

                    });
                    thingShadow.on('status', function (thingName, stat, clientToken, stateObject) {
                        try {
                            var json = stateObject.toString();

                            me.onStateReceivedCallback(json);

                        }
                        catch (e) {
                            me.onQueueErrorReceiveCallback('Error receiving the message: ' + e.message);
                        }
                    });
                    thingShadow.on('delta', function (thingName, stateObject) {
                        var state = JSON.stringify(stateObject);

                        me.onStateReceivedCallback(state);

                        thingShadow.update(thingName, {
                            state: {
                                reported: stateObject.state
                            }
                        });
                    });
                }
                else {
                    thingShadow.subscribe(nodeName, function (error, result) {
                        me.onQueueDebugCallback("AWS device is subscribing to " + nodeName);
                        callback();
                    });
                }


            }
        });
    };
    AWSIOT.prototype.Stop = function () {
        stop = true;
        if (thingShadow) {
            thingShadow.unsubscribe(nodeName, function (error, result) {
                me.onQueueDebugCallback("AWS device is stopped");
                // callback();
            });
        }
    };
    AWSIOT.prototype.Submit = function (message, node, service) {
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

        thingShadow.publish(node, JSON.stringify(message));

    };
    AWSIOT.prototype.Track = function (trackingMessage) {
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
    AWSIOT.prototype.Update = function (settings) {
        restTrackingToken = settings.trackingToken;
    };

}
module.exports = AWSIOT;

