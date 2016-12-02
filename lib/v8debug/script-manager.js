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
var Script = require('./script'),
    q = require('q'),
    proto,
    NORMAL_SCRIPTS = 4

function ScriptManager(client) {
  this._client = client
}

proto = ScriptManager.prototype

proto.fetch = function(options) {
  var deferred = q.defer(),
      promise

  this._client.request('scripts', options, deferred.makeNodeResolver())

  promise = deferred.promise.then(function (data) {
   
    if (data.body && data.body.length > 1) {
      return data.body.map(function(item) {
        return new Script(item)
      })
    }
    return new Script(data.body[0])
  })

  return promise;
}

proto.readScript = function(id, opts) {
  opts = opts || {}

  return this.fetch({
    type: opts.type || NORMAL_SCRIPTS,
    ids: [id],
    includeSource: true
  })
}

proto.listAll = function() {
  return this.fetch({
    type: NORMAL_SCRIPTS,
    includeSource: false
  })
}


module.exports = ScriptManager
