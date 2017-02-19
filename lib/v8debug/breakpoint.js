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

var _ = require('lodash'),
    EventEmitter = require('events').EventEmitter,
    inherits = require('util').inherits,
    q = require('q'),
    proto

/**
 *  type: 'script' || 'function'
 *  number: 'breakpoint number'
 *  enabled: 'same as active'
 *  condition: ''
 *  ignoreCount: ignoreCount
 *  line: num
 *  hit_count: num
 *
 */
inherits(BreakPoint, EventEmitter)
function BreakPoint(data, client) {
  EventEmitter.call(this)
  this.client = client

  _.extend(this, data)
}

proto = BreakPoint.prototype

proto.clear = function() {
  var deferred = q.defer()
  var self = this
  this.client.request('clearbreakpoint', {
    breakpoint: this.number
  }, deferred.makeNodeResolver())

  deferred.promise.then(function() {
    self.emit('destroy')
  })

  return deferred.promise
}

proto.active = function() {
  this.enabled = true
  return this.save()
}


proto.save = function() {
  var deferred = q.defer()
  var self = this

  this.client.request('changebreakpoint', {
    breakpoint: this.number,
    enabled: this.enabled,
    condition: this.condition,
    ignoreCount: this.ignoreCount
  }, deferred.makeNodeResolver())

  deferred.promise.then(function() {
    self.emit('change')
  })

  return deferred.promise
}

module.exports = BreakPoint
