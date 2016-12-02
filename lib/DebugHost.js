﻿/*
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
var colors = require('colors');
var util = require('./Utils.js');
var signalR = require('./v8debug/signalR.js');
var fs = require('fs');
var path = require('path');
var DebugClient = require('./v8debug/');

var rootFolder = process.arch == 'mipsel' ? '/mnt/sda1' : __dirname;
//require("microservicebus.core");
var maxWidth = 75;

function DebugHost() {
    var self = this;
    // Events
    this.onReady;
    this.onStopped;
    this.settings = {};
    var bm;
    var sm;
    
    var debugClient;
    var ScriptManager = DebugClient.ScriptManager;
    var debugPort;
    
    const SERVICEFOLDER = path.join(path.join(rootFolder.replace("lib", ""), "lib"), "services");

    var breakpoints;

    DebugHost.prototype.OnReady = function (callback) {
        this.onReady = callback;
    };
    DebugHost.prototype.OnStopped = function (callback) {
        this.onStopped = callback;
    };
    
    DebugHost.prototype.Start = function (port) {
        debugPort = port;
        setUpClient(function () {
            signalRClient.start();
            
        });
    };
    DebugHost.prototype.Stop = function (callback) {
        signalRClient.end();
        debugClient.disconnect();
        callback();
    };

    var settings = {
        "debug": false,
        "hubUri": "wss://microservicebus.com"
    }
    var data = fs.readFileSync('./lib/settings.json');
    self.settings = JSON.parse(data);

    var signalRClient = new signalR.client(
        self.settings.hubUri + '/signalR',
        ['debuggerHub'],
        10, //optional: retry timeout in seconds (default: 10)
        true
    );

    // Private methods
    function log(msg){
        msg = " " + msg;
        console.log(util.padRight(msg, maxWidth, ' ').bgYellow.white.bold);

    }
    function debugLog(msg) {
        msg = " " + msg;
        console.log(util.padRight(msg, maxWidth, ' ').bgGreen.white.bold);
    }
    function setUpClient(callback) {
        signalRClient.serviceHandlers = {
            bound: function () { log("Connection: " + "bound"); },
            connectFailed: function (error) {
                log("Connection: " + "Connect Failed");
            },
            connected: function (connection) {
                log("Connection: " + "Connected!");
                signalRClient.invoke('debuggerHub', 'debug_signIn', self.settings.nodeName, self.settings.organizationId);
                
            },
            disconnected: function () {

                log("Connection: " + "Disconnected");

            },
            onerror: function (error) {
                log("Connection: " + "Error: ", error);
            },
            messageReceived: function (message) {

            },
            bindingError: function (error) {
                log("Connection: " + "Binding Error: " + error);
            },
            connectionLost: function (error) {
                //_isWaitingForSignInResponse = false;
                log("Connection: " + "Connection Lost");
            },
            reconnected: void function (connection) {
                log("Connection: " + "Reconnected ");
            },
            onUnauthorized: function (res) { },
            reconnecting: function (retry /* { inital: true/false, count: 0} */) {
                log("Connection: " + "Retrying to connect ");
                return true;
            }
        };

        signalRClient.on('debuggerHub', 'debug_signedInComplete', function (message) {
            log("debug_signedInComplete");
            //self.onReady();
        });
        signalRClient.on('debuggerHub', 'debug_start', function (brkpoints) {
            log("debug_start");
            try {
                breakpoints = brkpoints;
                initDebugClient();
            }
            catch (ex) {
                log("exception:" + ex);
            }
        });
        signalRClient.on('debuggerHub', 'debug_continue', function (message) {
            //log("debug_continue");
            debugClient.continue(function (err, doneOrNot) { }); 
        });
        signalRClient.on('debuggerHub', 'debug_next', function (message) {
           // log("debug_next");
            debugClient.next(function (err, doneOrNot) { });
        });
        signalRClient.on('debuggerHub', 'debug_stepIn', function (message) {
           // log("debug_stepIn");
            debugClient.in(function (err, doneOrNot) { }); 
        });
        signalRClient.on('debuggerHub', 'debug_stepOver', function (message) {
            //log("debug_out");
        });
        signalRClient.on('debuggerHub', 'debug_stop', function (message) {
            //log("Disabling debug!");
            self.onStopped();
        });
        callback();
    }
    function initDebugClient(port) {
        debugClient = new DebugClient(debugPort);

        debugClient.on('connect', function () {
            debugLog("Debugger Connected");
            try {
                bm = new DebugClient.BreakPointManager(debugClient);
                sm = new ScriptManager(debugClient);

                breakpoints.forEach(function (myBrakpoint) {
                    var scriptFile = path.join(SERVICEFOLDER, myBrakpoint.script);

                    bm.createBreakpoint(scriptFile, myBrakpoint.line, myBrakpoint.condition)
                        .then(function (breakpoint) {
                            debugLog("breakpoint set at line " + myBrakpoint.line + " in " + myBrakpoint.script);
                        });
                });

                signalRClient.invoke('debuggerHub', 'debug_breakpointsSet');
                
            }
            catch (ex) {
                log("exception:" + ex);
            }
        });

        debugClient.on('break', function (breakInfo) {
            debugLog("break in " + path.basename(breakInfo.script.name) + " at " + breakInfo.sourceLine);
            var info = {
                script: path.basename(breakInfo.script.name),
                line: breakInfo.sourceLine,
                column: breakInfo.sourceColumn
            };
            signalRClient.invoke('debuggerHub', 'debug_breakpointsHit', info);
            
            debugClient.getFrame(function (err, frame) {
                debugLog("Got Frame data");
                var variables = [];
                for (var i = 0; i < frame.body.locals.length; i++) {
                    var variable = frame.body.locals[i];
                    var name = variable.name;
                    var value = frame.refs.find(function (ref) {
                        return ref.handle === variable.value.ref;
                    })
                    if (value.type !== "undefined")
                        variables.push({
                            name: name,
                            value: value.text,
                            type: value.type
                        });
                }
                signalRClient.invoke('debuggerHub', 'debug_breakpointFrame', variables);
            })
        })
    }
}
module.exports = DebugHost;