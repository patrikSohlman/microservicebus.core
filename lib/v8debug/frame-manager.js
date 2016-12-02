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
var Readable = require('stream').Readable
var Q = require('q')
var inherits = require('util').inherits
var Frame = require('./frame')

inherits(FrameManager, Readable)
function FrameManager(client) {
  Readable.call(this, {
    objectMode: true
  })
  this.client = client
  this.lastReciver = null;
}

FrameManager.prototype._read = function() {
  var deferred = Q.defer()
  var self = this
  
  if (self.isEnd) {
    return self.push(null)
  }

  this.client.request('frame', {
    number: this.lastReciver
  }, deferred.makeNodeResolver())

  deferred.promise.then(function(resp) {
    var body = resp.body
    var frame = new Frame(body)

    if (!body.receiver) {
      self.isEnd = true
    }

    self.lastReciver = frame.receiver
    self.push(frame)
  })
}

module.exports = FrameManager;
