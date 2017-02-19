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
var _ = require('lodash')


function camel(key) {
  return key.replace(/[-_](\w)/g, function(match) {
    return match[1].toUpperCase()
  })
}

function isEnumerable(val) {
  return val && (_.isArray(val) || _.isObject(val));
}

function keySwitcher(obj, switcherFn) {
  return _.transform(obj, function(result, val, key) {
    val = isEnumerable(val) ? keySwitcher(val, switcherFn) : val
    result[switcherFn(String(key))] = val
  })
}

exports.camelize = function(obj) {
  return keySwitcher(obj, camel)
}

function lodash(key) {
  return key.replace(/[A-Z]/g, function(match) {
    return '-' + match.toLowerCase()
  })
}

exports.lodashlize = function(obj) {
  return keySwitcher(obj, lodash)
}
