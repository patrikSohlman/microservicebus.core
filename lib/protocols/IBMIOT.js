﻿/*
The MIT License (MIT)

Copyright (c) 2014 microServiceBus.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without IBMIOTriction, including without limitation the rights
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
var crypto = require('crypto');
var httpRequest = require('request');
var storage = require('node-persist');
var util = require('../Utils.js');
var guid = require('uuid');

function IBMIOT(nodeName, sbSettings) {
  
    var storageIsEnabled = true;
    var stop = false;
    var me = this;
    var tokenRefreshTimer;
    var tokenRefreshInterval = (sbSettings.tokenLifeTime * 60 * 1000) * 0.9;
    var IBMIOTTrackingToken = sbSettings.trackingToken;
    var baseAddress = "https://" + sbSettings.sbNamespace;

    if (!baseAddress.match(/\/$/)) {
        baseAddress += '/';
    }

    IBMIOT.prototype.Start = function (callback) {
        stop = false;
        me = this;
      
        tokenRefreshTimer = setInterval(function () {
            me.onQueueDebugCallback("Update tracking tokens");
            acquireToken("MICROSERVICEBUS", "TRACKING", IBMIOTTrackingToken, function (token) {
                if (token == null) {
                    me.onQueueErrorSubmitCallback("Unable to aquire tracking token: " + token);
                }
                else {
                    IBMIOTTrackingToken = token;
                }
            });
        }, tokenRefreshInterval);

        if (callback != null)
            callback();
    };
    IBMIOT.prototype.Stop = function (callback) {
        stop = true;
        clearTimeout(tokenRefreshTimer);
        callback();
    };
    IBMIOT.prototype.Submit = function (message, node, service) {

    };
    IBMIOT.prototype.Track = function (trackingMessage) {
        try {
            if (stop) {

                if (storageIsEnabled)
                    storage.setItemSync("_tracking_" + trackingMessage.InterchangeId, trackingMessage);

                return;
            }

            var trackUri = baseAddress + sbSettings.trackingHubName + "/messages" + "?timeout=60";

            httpRequest({
                headers: {
                    "Authorization": IBMIOTTrackingToken,
                    "Content-Type": "application/json",
                },
                uri: trackUri,
                json: trackingMessage,
                method: 'POST'
            },
                function (err, res, body) {
                    if (err != null) {
                        me.onQueueErrorSubmitCallback("Unable to send message. " + err.code + " - " + err.message);
                        console.log("Unable to send message. " + err.code + " - " + err.message);
                        if (storageIsEnabled)
                            storage.setItemSync("_tracking_" + trackingMessage.InterchangeId, trackingMessage);
                    }
                    else if (res.statusCode >= 200 && res.statusCode < 300) {
                    }
                    else if (res.statusCode == 401) {
                        me.onQueueDebugCallback("Expired tracking token. Updating token...");
                        if (storageIsEnabled)
                            storage.setItemSync("_tracking_" + trackingMessage.InterchangeId, trackingMessage);
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
    IBMIOT.prototype.Update = function (settings) {
        IBMIOTMessagingToken = settings.messagingToken;
        IBMIOTTrackingToken = settings.trackingToken;
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
                        me.onQueueErrorSubmitCallback("URL: " + acquireTokenUri);
                        callback(null);
                    }
                });
        }
        catch (err) {
            process.exit(1);
        }
    };
}
module.exports = IBMIOT;