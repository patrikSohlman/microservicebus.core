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

function Protocol() {

}

Protocol.prototype.serilize = function(obj) {
  var json = JSON.stringify(obj)

  return 'Content-Length: ' + Buffer.byteLength(json, 'utf8') +
         '\r\n\r\n' +
         json
}

Protocol.prototype.version = function(seq) {
  var json = { seq: seq, type: 'request', command: 'version' }
  return this.serilize(json)
}

Protocol.prototype.continue = function (seq, type, step) {
    var request = {
        seq: seq,
        type: 'request',
        command: 'continue'
    }
    if (type) {
        request.arguments = {}
        request.arguments.stepaction = type
    }

    if (step) {
        request.arguments = request.arguments || {}
        request.arguments.stepcount = step
    }

    return this.serilize(request);
}
Protocol.prototype.frame = function (seq, type, step) {
    var request = {
        seq: seq,
        type: 'request',
        command: 'frame'
    }

    return this.serilize(request);
}
module.exports = Protocol
