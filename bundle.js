!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var n;"undefined"!=typeof window?n=window:"undefined"!=typeof global?n=global:"undefined"!=typeof self&&(n=self),(n.skynetPlugins||(n.skynetPlugins={})).skynetHeartbeat=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var heartrate = _dereq_('./heartrate');

function Plugin(messenger, options, api, deviceName) {
  var self = this;
  if (!options) {
    options = {};
  }
  if (typeof deviceName === 'string') {
    self.name = deviceName;
  } else if (deviceName) {
    self.name = deviceName.name;
    self.uuid = deviceName.uuid;
  } else {
    self.name = _dereq_('./package.json').name;
    // Use Test UUID
    self.uuid = 'ega98481-3d45-11fO-8982-6b4asd5f4sska';
  }

  self.messenger = messenger;
  self.options = options || {};

  self.api = api; // Mobile Specific

  self.mobile = false;

  if (self.api && typeof self.api.logActivity === 'function') {
    self.mobile = true;
  }

  var logIt = function(err, msg) {
    var obj = {
      type: self.name
    };
    if (err) {
      obj.error = err;
    }
    if (msg) {
      obj.html = msg;
    }
    if (self.mobile) {
      self.api.logActivity(obj);
    } else {
      console.log('logIt (HeartRate): ' + JSON.stringify(obj));
    }
  };

  if (!options.addressKey) {
    options.addressKey = 'heart_' + self.uuid;
  }

  function logHeartrate(hr) {
    self.messenger.data({
      device: self.name,
      type: 'heartRate',
      heartRate: hr
    });
    logIt(null, 'Logged Heartbeat : ' + hr);
  }

  heartrate.init(options, {
    logIt: logIt,
    logHeartrate: logHeartrate
  });

  console.log('Initialized HeartRate Plugin');

  return self;
}

module.exports = {
  Plugin: Plugin
};
}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/fake_4d3b4072.js","/")
},{"./heartrate":2,"./package.json":28,"IrXUsu":10,"buffer":4}],2:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var Scanner = _dereq_('./scan');

var lib = {},
  options,
  api,
  serviceUuid = '180d',
  serviceUuids = [serviceUuid],
  characteristicUuid = '2a37';

function startMonitor(fn) {
  new Scanner(25 * 1000, serviceUuids, function(peripheral) {
  	if(!peripheral){
  		return fn({ error : 'No HeartRate Monitor Found' });
  	}
    function getHeartrate(data) {
      if (data instanceof Uint8Array) {
        var bytes = data;
        //Check for data
        if (bytes.length === 0) {
          console.log('Subscription result had zero length data');
          return;
        }

        //Get the first byte that contains flags
        var flag = bytes[0];

        //Check if u8 or u16 and get heart rate
        var hr;
        if ((flag & 0x01) === 1) {
          var u16bytes = bytes.buffer.slice(1, 3);
          var u16 = new Uint16Array(u16bytes)[0];
          hr = u16;
        } else {
          var u8bytes = bytes.buffer.slice(1, 2);
          var u8 = new Uint8Array(u8bytes)[0];
          hr = u8;
        }
        return hr;
      } else {
        return data.readUInt8(1);
      }
    }

    function onRead(data) {
      if (data) {
        var obj = {
          heartRate: getHeartrate(data)
        };
        console.log('heart rate', obj.heartRate);
        fn(obj);
      } else {
        fn({
          error: 'Unable to read to heart rate'
        });
      }
    }

    function subsribe(mainCharacteristic) {
      mainCharacteristic.on('read', onRead);

      // true to enable notify
      mainCharacteristic.notify(true, function(error) {
        console.log('Heart rate level notification');
        if (error) {
          fn({
            error: 'Unable to subscribe to heart rate'
          });
        }
      });
    }

    function getCharacteristics(deviceService) {
      deviceService.discoverCharacteristics([characteristicUuid], function(error, characteristics) {
        if (error) {
          console.log('Error discovering characteristics', error);
          fn({
            error: error
          });
        } else {
          var mainCharacteristic = characteristics[0];
          console.log('Discovered heart rate characteristic for read', mainCharacteristic.uuid);
          subsribe(mainCharacteristic);
        }
      });
    }

    function getServices() {
      peripheral.discoverServices(serviceUuids, function(error, services) {
        var deviceService = services[0];
        if (!deviceService) {
          var msg = 'No heart rate service found';
          console.log('Discover services error', services);
          return fn({
            error: msg
          });
        } else {
          console.log('Discovered heart rate service for read', deviceService.uuid);
        }
        getCharacteristics(deviceService);
      });
    }

    function disonnect() {
      peripheral.disconnect();
    }

    function readyForDisonnect() {
      if (typeof document !== 'undefined') {
        document.addEventListener('pause', disonnect);
      }
    }

    function onConnect() {
      readyForDisonnect();
      getServices();
    }

    function connect() {
      peripheral.connect(onConnect);
    }
    console.log('Peripheral', peripheral);
    if (peripheral.state === 'connected') {
      console.log('Already connected to peripheral');
      onConnect();
    } else {
      console.log('Connecting to peripheral');
      connect();
    }

  }, api.logIt);
}

lib.init = function(opts, newApi) {
  options = opts;
  api = newApi;

  startMonitor(function(data) {
    if (!data) data = {};
    if (data.error) {
      console.log('Error in Heartbeat Plugin: ' + JSON.stringify(data.error));
      api.logIt(data.error);
    } else {
      api.logHeartrate(data.heartRate);
    }
  });

};

module.exports = lib;
}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/heartrate.js","/")
},{"./scan":29,"IrXUsu":10,"buffer":4}],3:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/browserify/node_modules/browser-resolve/empty.js","/node_modules/gulp-browserify/node_modules/browserify/node_modules/browser-resolve")
},{"IrXUsu":10,"buffer":4}],4:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = _dereq_('base64-js')
var ieee754 = _dereq_('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
  // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,
  // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding
  // properties to `Uint8Array` instances, then that's the same as no `Uint8Array` support
  // because we need to be able to add all the node Buffer API methods. This is an issue
  // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Workaround: node's base64 implementation allows for non-padded strings
  // while base64-js does not.
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // assume that object is array-like
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

// BUFFER INSTANCE METHODS
// =======================

function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function _asciiWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function _utf16leWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = _asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = _binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = _base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = _asciiSlice(self, start, end)
      break
    case 'binary':
      ret = _binarySlice(self, start, end)
      break
    case 'base64':
      ret = _base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer._useTypedArrays) {
    for (var i = 0; i < len; i++)
      target[i + target_start] = this[i + start]
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function _base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function _utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++)
    ret += String.fromCharCode(buf[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function _utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1)
        buf[i] = this[i]
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/index.js","/node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer")
},{"IrXUsu":10,"base64-js":5,"buffer":4,"ieee754":6}],5:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib/b64.js","/node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib")
},{"IrXUsu":10,"buffer":4}],6:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/ieee754/index.js","/node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/ieee754")
},{"IrXUsu":10,"buffer":4}],7:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/browserify/node_modules/events/events.js","/node_modules/gulp-browserify/node_modules/browserify/node_modules/events")
},{"IrXUsu":10,"buffer":4}],8:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/browserify/node_modules/inherits/inherits_browser.js","/node_modules/gulp-browserify/node_modules/browserify/node_modules/inherits")
},{"IrXUsu":10,"buffer":4}],9:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
exports.endianness = function () { return 'LE' };

exports.hostname = function () {
    if (typeof location !== 'undefined') {
        return location.hostname
    }
    else return '';
};

exports.loadavg = function () { return [] };

exports.uptime = function () { return 0 };

exports.freemem = function () {
    return Number.MAX_VALUE;
};

exports.totalmem = function () {
    return Number.MAX_VALUE;
};

exports.cpus = function () { return [] };

exports.type = function () { return 'Browser' };

exports.release = function () {
    if (typeof navigator !== 'undefined') {
        return navigator.appVersion;
    }
    return '';
};

exports.networkInterfaces
= exports.getNetworkInterfaces
= function () { return {} };

exports.arch = function () { return 'javascript' };

exports.platform = function () { return 'browser' };

exports.tmpdir = exports.tmpDir = function () {
    return '/tmp';
};

exports.EOL = '\n';

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/browserify/node_modules/os-browserify/browser.js","/node_modules/gulp-browserify/node_modules/browserify/node_modules/os-browserify")
},{"IrXUsu":10,"buffer":4}],10:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/browserify/node_modules/process/browser.js","/node_modules/gulp-browserify/node_modules/browserify/node_modules/process")
},{"IrXUsu":10,"buffer":4}],11:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/browserify/node_modules/util/support/isBufferBrowser.js","/node_modules/gulp-browserify/node_modules/browserify/node_modules/util/support")
},{"IrXUsu":10,"buffer":4}],12:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = _dereq_('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = _dereq_('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/browserify/node_modules/util/util.js","/node_modules/gulp-browserify/node_modules/browserify/node_modules/util")
},{"./support/isBuffer":11,"IrXUsu":10,"buffer":4,"inherits":8}],13:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var Noble = _dereq_('./lib/noble');

module.exports = new Noble();

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/noble/index.js","/node_modules/noble")
},{"./lib/noble":22,"IrXUsu":10,"buffer":4}],14:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var events = _dereq_('events');
var util = _dereq_('util');

var debug = _dereq_('debug')('bindings');


var NobleBindings = function() {


  console.log('chrome noble bindings');

  this._startScanCommand = null;
  this._peripherals = {};

  this.on('message', this._onMessage.bind(this));
};

util.inherits(NobleBindings, events.EventEmitter);

NobleBindings.prototype._onOpen = function() {
  console.log('on -> open');
};

NobleBindings.prototype._onClose = function() {
  console.log('on -> close');

  this.emit('stateChange', 'poweredOff');
};

NobleBindings.prototype._onMessage = function(event) {
  var type = event.type;
  var peripheralUuid = event.peripheralUuid;
  var advertisement = event.advertisement;
  var rssi = event.rssi;
  var serviceUuids = event.serviceUuids;
  var serviceUuid = event.serviceUuid;
  var includedServiceUuids = event.includedServiceUuids;
  var characteristics = event.characteristics;
  var characteristicUuid = event.characteristicUuid;
  var data = event.data ? new Buffer(event.data, 'hex') : null;
  var isNotification = event.isNotification;
  var state = event.state;
  var descriptors = event.descriptors;
  var descriptorUuid = event.descriptorUuid;
  var handle = event.handle;

  if (type === 'stateChange') {
    console.log(state);
    this.emit('stateChange', state);
  } else if (type === 'discover') {
    advertisement = {
      localName: advertisement.localName,
      txPowerLevel: advertisement.txPowerLevel,
      serviceUuids: advertisement.serviceUuids,
      manufacturerData: (advertisement.manufacturerData ? new Buffer(advertisement.manufacturerData, 'hex') : null),
      serviceData: (advertisement.serviceData ? new Buffer(advertisement.serviceData, 'hex') : null)
    };

    this._peripherals[peripheralUuid] = {
      uuid: peripheralUuid,
      advertisement: advertisement,
      rssi: rssi
    };

    this.emit('discover', peripheralUuid, advertisement, rssi);
  } else if (type === 'connect') {
    this.emit('connect', peripheralUuid);
  } else if (type === 'disconnect') {
    this.emit('disconnect', peripheralUuid);
  } else if (type === 'rssiUpdate') {
    this.emit('rssiUpdate', peripheralUuid, rssi);
  } else if (type === 'servicesDiscover') {
    this.emit('servicesDiscover', peripheralUuid, serviceUuids);
  } else if (type === 'includedServicesDiscover') {
    this.emit('includedServicesDiscover', peripheralUuid, serviceUuid, includedServiceUuids);
  } else if (type === 'characteristicsDiscover') {
    this.emit('characteristicsDiscover', peripheralUuid, serviceUuid, characteristics);
  } else if (type === 'read') {
    this.emit('read', peripheralUuid, serviceUuid, characteristicUuid, data, isNotification);
  } else if (type === 'write') {
    this.emit('write', peripheralUuid, serviceUuid, characteristicUuid);
  } else if (type === 'broadcast') {
    this.emit('broadcast', peripheralUuid, serviceUuid, characteristicUuid, state);
  } else if (type === 'notify') {
    this.emit('notify', peripheralUuid, serviceUuid, characteristicUuid, state);
  } else if (type === 'descriptorsDiscover') {
    this.emit('descriptorsDiscover', peripheralUuid, serviceUuid, characteristicUuid, descriptors);
  } else if (type === 'valueRead') {
    this.emit('valueRead', peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid, data);
  } else if (type === 'valueWrite') {
    this.emit('valueWrite', peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid);
  } else if (type === 'handleRead') {
    this.emit('handleRead', handle, data);
  } else if (type === 'handleWrite') {
    this.emit('handleWrite', handle);
  }
};

NobleBindings.prototype._sendCommand = function(command) {
  var message = JSON.stringify(command);

  this._ws.send(message);
};

NobleBindings.prototype.startScanning = function(serviceUuids, allowDuplicates) {
  this._startScanCommand = {
    action: 'startScanning',
    serviceUuids: serviceUuids,
    allowDuplicates: allowDuplicates
  };
  this._sendCommand(this._startScanCommand);

  this.emit('scanStart');
};

NobleBindings.prototype.stopScanning = function() {
  this._startScanCommand = null;

  this._sendCommand({
    action: 'stopScanning'
  });

  this.emit('scanStop');
};

NobleBindings.prototype.connect = function(deviceUuid) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'connect',
    peripheralUuid: peripheral.uuid
  });
};

NobleBindings.prototype.disconnect = function(deviceUuid) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'disconnect',
    peripheralUuid: peripheral.uuid
  });
};

NobleBindings.prototype.updateRssi = function(deviceUuid) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'updateRssi',
    peripheralUuid: peripheral.uuid
  });
};

NobleBindings.prototype.discoverServices = function(deviceUuid, uuids) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'discoverServices',
    peripheralUuid: peripheral.uuid,
    uuids: uuids
  });
};

NobleBindings.prototype.discoverIncludedServices = function(deviceUuid, serviceUuid, serviceUuids) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'discoverIncludedServices',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    serviceUuids: serviceUuids
  });
};

NobleBindings.prototype.discoverCharacteristics = function(deviceUuid, serviceUuid, characteristicUuids) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'discoverCharacteristics',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    characteristicUuids: characteristicUuids
  });
};

NobleBindings.prototype.read = function(deviceUuid, serviceUuid, characteristicUuid) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'read',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    characteristicUuid: characteristicUuid
  });
};

NobleBindings.prototype.write = function(deviceUuid, serviceUuid, characteristicUuid, data, withoutResponse) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'write',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    characteristicUuid: characteristicUuid,
    data: data.toString('hex'),
    withoutResponse: withoutResponse
  });
};

NobleBindings.prototype.broadcast = function(deviceUuid, serviceUuid, characteristicUuid, broadcast) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'broadcast',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    characteristicUuid: characteristicUuid,
    broadcast: broadcast
  });
};

NobleBindings.prototype.notify = function(deviceUuid, serviceUuid, characteristicUuid, notify) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'notify',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    characteristicUuid: characteristicUuid,
    notify: notify
  });
};

NobleBindings.prototype.discoverDescriptors = function(deviceUuid, serviceUuid, characteristicUuid) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'discoverDescriptors',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    characteristicUuid: characteristicUuid
  });
};

NobleBindings.prototype.readValue = function(deviceUuid, serviceUuid, characteristicUuid, descriptorUuid) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'readValue',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    characteristicUuid: characteristicUuid,
    descriptorUuid: descriptorUuid
  });
};

NobleBindings.prototype.writeValue = function(deviceUuid, serviceUuid, characteristicUuid, descriptorUuid, data) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'writeValue',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    characteristicUuid: characteristicUuid,
    descriptorUuid: descriptorUuid,
    data: data.toString('hex')
  });
};

NobleBindings.prototype.readHandle = function(deviceUuid, handle) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'readHandle',
    peripheralUuid: peripheral.uuid,
    handle: handle
  });
};

NobleBindings.prototype.writeHandle = function(deviceUuid, handle, data, withoutResponse) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'readHandle',
    peripheralUuid: peripheral.uuid,
    handle: handle,
    data: data.toString('hex'),
    withoutResponse: withoutResponse
  });
};

var nobleBindings = new NobleBindings();

module.exports = nobleBindings;

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/noble/lib/browser/chrome/bindings.js","/node_modules/noble/lib/browser/chrome")
},{"IrXUsu":10,"buffer":4,"debug":26,"events":7,"util":12}],15:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
if(window.chrome && window.chrome.bluetoothLowEnergy){
  console.log('using chrome app bindings');
  module.exports = _dereq_('./chrome/bindings');
}
else if(window.bluetoothle){
  console.log('using phonegap bindings');
  module.exports = _dereq_('./phonegap/bindings');
}
else{
  console.log('using websocket bindings');
  module.exports = _dereq_('./websocket/bindings');
}

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/noble/lib/browser/index.js","/node_modules/noble/lib/browser")
},{"./chrome/bindings":14,"./phonegap/bindings":16,"./websocket/bindings":17,"IrXUsu":10,"buffer":4}],16:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var events = _dereq_('events');
var util = _dereq_('util');

var debug = _dereq_('debug')('bindings');

var ble = window.bluetoothle;


//included in newer bluetoothLE
function bytesToEncodedString(bytes) {
  return btoa(String.fromCharCode.apply(null, bytes));
}

function equalUuids(uuid1, uuid2){
  if(!uuid1 || !uuid2){
    return false;
  }
  uuid1 = uuid1.toLowerCase().split('-').join('').split(':').join('');
  uuid2 = uuid2.toLowerCase().split('-').join('').split(':').join('');

  if(uuid1.length === uuid2.length){
    return uuid1 === uuid2;
  }

  if(uuid1.length > 4){
    uuid1 = uuid1.substring(4,8);
  }

  if(uuid2.length > 4){
    uuid2 = uuid2.substring(4,8);
  }

  //TODO 6 byte uuids?

  return uuid1 === uuid2;

}

var NobleBindings = function() {

  var self = this;
  self.enabled = false;
  self._peripherals = {};
  self.platform = null;

  if(typeof window !== 'undefined' && window.device){
    self.platform = window.device.platform;
  }
  console.log('Device Platform: ', self.platform);

  console.log('phonegap (bluetoothle) noble bindings');

  ble.initialize(function(data){
    if(data.status === 'enabled'){
      self.enabled = true;
      console.log('ble initialized');
    }
  }, function(err){
    console.log('cant initialize ble', err);
  }, {request: true});

};

util.inherits(NobleBindings, events.EventEmitter);

NobleBindings.prototype._onOpen = function() {
  console.log('on -> open');
};

NobleBindings.prototype._onClose = function() {
  console.log('on -> close');

  this.emit('stateChange', 'poweredOff');
};

// NobleBindings.prototype._onMessage = function(event) {
//   var type = event.type;
//   var peripheralUuid = event.peripheralUuid;
//   var advertisement = event.advertisement;
//   var rssi = event.rssi;
//   var serviceUuids = event.serviceUuids;
//   var serviceUuid = event.serviceUuid;
//   var includedServiceUuids = event.includedServiceUuids;
//   var characteristics = event.characteristics;
//   var characteristicUuid = event.characteristicUuid;
//   var data = event.data ? new Buffer(event.data, 'hex') : null;
//   var isNotification = event.isNotification;
//   var state = event.state;
//   var descriptors = event.descriptors;
//   var descriptorUuid = event.descriptorUuid;
//   var handle = event.handle;

//   if (type === 'stateChange') {
//     console.log(state);
//     this.emit('stateChange', state);
//   } else if (type === 'rssiUpdate') {
//     this.emit('rssiUpdate', peripheralUuid, rssi);
//   } else if (type === 'includedServicesDiscover') {
//     this.emit('includedServicesDiscover', peripheralUuid, serviceUuid, includedServiceUuids);
//   } else if (type === 'read') {
//     this.emit('read', peripheralUuid, serviceUuid, characteristicUuid, data, isNotification);
//   } else if (type === 'broadcast') {
//     this.emit('broadcast', peripheralUuid, serviceUuid, characteristicUuid, state);
//   } else if (type === 'notify') {
//     this.emit('notify', peripheralUuid, serviceUuid, characteristicUuid, state);
//   } else if (type === 'descriptorsDiscover') {
//     this.emit('descriptorsDiscover', peripheralUuid, serviceUuid, characteristicUuid, descriptors);
//   } else if (type === 'valueRead') {
//     this.emit('valueRead', peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid, data);
//   } else if (type === 'valueWrite') {
//     this.emit('valueWrite', peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid);
//   } else if (type === 'handleRead') {
//     this.emit('handleRead', handle, data);
//   } else if (type === 'handleWrite') {
//     this.emit('handleWrite', handle);
//   }
// };


NobleBindings.prototype.startScanning = function(serviceUuids, allowDuplicates) {
  var self = this;
  console.log('startScanning', serviceUuids, allowDuplicates);
  ble.startScan(function(data){
    console.log('scan', data);
    if(data.status === 'scanResult'){
      self._peripherals[data.address] = data;
      self.emit('discover', data.address, {localName:data.name, serviceUuids: serviceUuids}, data.rssi);
    }
  }, function(err){
    console.log('cant scan ble', err);
  }, {serviceUuids: serviceUuids});

  this.emit('scanStart');
};

NobleBindings.prototype.stopScanning = function() {
  var self = this;

  ble.stopScan(function(data){
    console.log('stop scan', data);
  }, function(err){
    console.log('cant stop scan', err);
  });

  this.emit('scanStop');
};

NobleBindings.prototype.connect = function(deviceUuid) {
  var self = this;
  function onConnect(data){
  	console.log('connect', data);
    if(data.status === 'connected'){
      self.emit('connect', deviceUuid);
    }
  }
  ble.connect(onConnect, function(err){
    ble.reconnect(onConnect, function(){
	    console.log('cant connect', err);
    });
  }, {address: deviceUuid});
};

NobleBindings.prototype.disconnect = function(deviceUuid) {
  ble.disconnect(function(data){
    console.log('disconnect', data);
  }, function(err){
    console.log('cant disconnect', err);
  });
};

NobleBindings.prototype.updateRssi = function(deviceUuid) {
  //TODO
  console.log('updateRssi', deviceUuid);
};

NobleBindings.prototype.discoverServices = function(deviceUuid, uuids) {

  var self = this;

  if(self.platform && self.platform === 'iOS'){
    //IOS only :(
    ble.services(function(data){
      console.log('discoverServices ble.services', data);
      self.emit('servicesDiscover', deviceUuid, data.serviceUuids);
    }, function(err){
      console.log('cant discoverServices ble.services', err);
    }, {'serviceUuids':uuids});
  }else{
    //Android only :(
    ble.discover(function(data){
      console.log('discoverServices ble.discover', data);
      var matchingServices = [];
      if(!Array.isArray(uuids)){
        uuids = [uuids];
      }
      uuids.forEach(function(uuid){
        data.services.forEach(function(service){
          console.log('checking', uuid, 'against', service.serviceUuid);
          if(equalUuids(uuid, service.serviceUuid)){
            console.log('match found', uuid);
            matchingServices.push(service.serviceUuid);
          }
        });
      });

      self.emit('servicesDiscover', deviceUuid, matchingServices);
    }, function(err){
      console.log('cant discoverServices ble.discover', err);
    });
  }


};

NobleBindings.prototype.discoverIncludedServices = function(deviceUuid, serviceUuid, serviceUuids) {
  var peripheral = this._peripherals[deviceUuid];

  //TODO

  // this._sendCommand({
  //   action: 'discoverIncludedServices',
  //   peripheralUuid: peripheral.uuid,
  //   serviceUuid: serviceUuid,
  //   serviceUuids: serviceUuids
  // });
};

NobleBindings.prototype.discoverCharacteristics = function(deviceUuid, serviceUuid, characteristicUuids) {
  var peripheral = this._peripherals[deviceUuid];
  var self = this;

  console.log('discoverCharacteristics', deviceUuid, serviceUuid, characteristicUuids);

  if(self.platform && self.platform === 'iOS'){
    //IOS only :(
    ble.characteristics(function(data){
      console.log('discoverCharacteristics ble.characteristics', data);
      var characteristics = [];
      // Latest version of ble returns different status
      if(data.status && ['discoveredCharacteristics', 'discoverCharacteristics'].indexOf(data.status) > -1){
        characteristics = data.characteristics || data.characteristicUuids || [];
      }else{
        console.log('Incorrect results returned from discoverCharacteristics');
        characteristics = characteristicUuids || [];
      }
      var characteristObjects = [];
      characteristics.forEach(function(characteristic){
      	var uuid;
      	if(typeof characteristic === 'string'){
      		uuid = characteristic;
      	}else{
      		uuid = characteristic.characteristicUuid;
      	}
        characteristObjects.push({ uuid: uuid  });
      });
      self.emit('characteristicsDiscover', deviceUuid, serviceUuid, characteristObjects);
    }, function(err){
      console.log('cant discoverCharacteristics ble.characteristics', err);
    }, {'serviceUuid':serviceUuid,'characteristicUuids':characteristicUuids});
  }else{
    //Android hack :(
    ble.discover(function(data){
      console.log('discoverCharacteristics ble.discover', data);
      var matchingChars = [];

      data.services.forEach(function(service){
        if(equalUuids(serviceUuid, service.serviceUuid)){
          console.log('matched service in discoverCharacteristics', serviceUuid);
          if(!Array.isArray(characteristicUuids)){
            characteristicUuids = [characteristicUuids];
          }
          console.log('checking: ' + JSON.stringify(characteristicUuids) + ' against: ' +  JSON.stringify(service.characteristics));
          characteristicUuids.forEach(function(uuid){
            service.characteristics.forEach(function(characteristic){
              console.log('checking characteristicAssignedNumber' + characteristic.characteristicUuid.toLowerCase() + ' :: ' + uuid);
              if(equalUuids(characteristic.characteristicUuid, uuid)){
                matchingChars.push({uuid: characteristic.characteristicUuid});
              }
            });
          });

        }
      });

      console.log('matchingChars: ' + JSON.stringify(matchingChars));
      self.emit('characteristicsDiscover', deviceUuid, serviceUuid, matchingChars);

    }, function(err){
      console.log('cant discoverCharacteristics ble.discover', err);
    });
  }

};

NobleBindings.prototype.read = function(deviceUuid, serviceUuid, characteristicUuid) {
  var peripheral = this._peripherals[deviceUuid];
  var self = this;

  console.log('read', deviceUuid, serviceUuid, characteristicUuid);

  ble.read(function(resp){
    console.log('read ble.read', resp);
    self.emit('read', deviceUuid, serviceUuid, characteristicUuid, atob(resp.value), false);
  }, function(err){
    console.log('cant read ble.read', err);
  }, {"serviceUuid":serviceUuid,"characteristicUuid":characteristicUuid});

};

NobleBindings.prototype.write = function(deviceUuid, serviceUuid, characteristicUuid, data, withoutResponse) {
  var peripheral = this._peripherals[deviceUuid];
  var self = this;

  console.log('write', deviceUuid, serviceUuid, characteristicUuid, data, withoutResponse);

  ble.write(function(resp){
    console.log('write ble.write', resp);
    if(!withoutResponse){
      self.emit('write', deviceUuid, serviceUuid, characteristicUuid);
    }
  }, function(err){
    console.log('cant write ble.write', err);
  }, {"value":bytesToEncodedString(data),"serviceUuid":serviceUuid,"characteristicUuid":characteristicUuid});

};

NobleBindings.prototype.broadcast = function(deviceUuid, serviceUuid, characteristicUuid, broadcast) {
  var peripheral = this._peripherals[deviceUuid];

  // TODO ? don't see this functionality in the phonegap plugin

  // this._sendCommand({
  //   action: 'broadcast',
  //   peripheralUuid: peripheral.uuid,
  //   serviceUuid: serviceUuid,
  //   characteristicUuid: characteristicUuid,
  //   broadcast: broadcast
  // });
};

NobleBindings.prototype.notify = function(deviceUuid, serviceUuid, characteristicUuid, notify) {
  var peripheral = this._peripherals[deviceUuid];
  var self = this;

  console.log('notify', deviceUuid, serviceUuid, characteristicUuid, notify);
  ble.subscribe(function(data){
    console.log('subscribe', data);
    if(data.status === 'subscribedResult'){
      self.emit('notify', deviceUuid, serviceUuid, characteristicUuid, ble.encodedStringToBytes(data.value));
      self.emit('read', deviceUuid, serviceUuid, characteristicUuid, ble.encodedStringToBytes(data.value), true);
    }
  }, function(err){
    console.log('cant notify', err);
  }, {"serviceUuid":serviceUuid,"characteristicUuid":characteristicUuid,"isNotification":true});

};

NobleBindings.prototype.discoverDescriptors = function(deviceUuid, serviceUuid, characteristicUuid) {
  var peripheral = this._peripherals[deviceUuid];

  // this._sendCommand({
  //   action: 'discoverDescriptors',
  //   peripheralUuid: peripheral.uuid,
  //   serviceUuid: serviceUuid,
  //   characteristicUuid: characteristicUuid
  // });
};

NobleBindings.prototype.readValue = function(deviceUuid, serviceUuid, characteristicUuid, descriptorUuid) {
  var peripheral = this._peripherals[deviceUuid];

  // this._sendCommand({
  //   action: 'readValue',
  //   peripheralUuid: peripheral.uuid,
  //   serviceUuid: serviceUuid,
  //   characteristicUuid: characteristicUuid,
  //   descriptorUuid: descriptorUuid
  // });
};

NobleBindings.prototype.writeValue = function(deviceUuid, serviceUuid, characteristicUuid, descriptorUuid, data) {
  var peripheral = this._peripherals[deviceUuid];

  // this._sendCommand({
  //   action: 'writeValue',
  //   peripheralUuid: peripheral.uuid,
  //   serviceUuid: serviceUuid,
  //   characteristicUuid: characteristicUuid,
  //   descriptorUuid: descriptorUuid,
  //   data: data.toString('hex')
  // });
};

NobleBindings.prototype.readHandle = function(deviceUuid, handle) {
  var peripheral = this._peripherals[deviceUuid];

  // this._sendCommand({
  //   action: 'readHandle',
  //   peripheralUuid: peripheral.uuid,
  //   handle: handle
  // });
};

NobleBindings.prototype.writeHandle = function(deviceUuid, handle, data, withoutResponse) {
  var peripheral = this._peripherals[deviceUuid];

  // this._sendCommand({
  //   action: 'readHandle',
  //   peripheralUuid: peripheral.uuid,
  //   handle: handle,
  //   data: data.toString('hex'),
  //   withoutResponse: withoutResponse
  // });
};

var nobleBindings = new NobleBindings();

module.exports = nobleBindings;

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/noble/lib/browser/phonegap/bindings.js","/node_modules/noble/lib/browser/phonegap")
},{"IrXUsu":10,"buffer":4,"debug":26,"events":7,"util":12}],17:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var events = _dereq_('events');
var util = _dereq_('util');

var debug = _dereq_('debug')('bindings');
var WebSocket = _dereq_('ws');

var NobleBindings = function() {
  var port = 0xB1e;
  this._ws = new WebSocket('ws://localhost:' + port);

  this._startScanCommand = null;
  this._peripherals = {};

  this.on('message', this._onMessage.bind(this));

  if (!this._ws.on) {
    this._ws.on = this._ws.addEventListener;
  }

  this._ws.on('open', this._onOpen.bind(this));
  this._ws.on('close', this._onClose.bind(this));

  var _this = this;
  this._ws.on('message', function(event) {
    var data = (process.title === 'browser') ? event.data : event;
    
    _this.emit('message', JSON.parse(data));
  });
};

util.inherits(NobleBindings, events.EventEmitter);

NobleBindings.prototype._onOpen = function() {
  console.log('on -> open');
};

NobleBindings.prototype._onClose = function() {
  console.log('on -> close');

  this.emit('stateChange', 'poweredOff');
};

NobleBindings.prototype._onMessage = function(event) {
  var type = event.type;
  var peripheralUuid = event.peripheralUuid;
  var advertisement = event.advertisement;
  var rssi = event.rssi;
  var serviceUuids = event.serviceUuids;
  var serviceUuid = event.serviceUuid;
  var includedServiceUuids = event.includedServiceUuids;
  var characteristics = event.characteristics;
  var characteristicUuid = event.characteristicUuid;
  var data = event.data ? new Buffer(event.data, 'hex') : null;
  var isNotification = event.isNotification;
  var state = event.state;
  var descriptors = event.descriptors;
  var descriptorUuid = event.descriptorUuid;
  var handle = event.handle;

  if (type === 'stateChange') {
    console.log(state);
    this.emit('stateChange', state);
  } else if (type === 'discover') {
    advertisement = {
      localName: advertisement.localName,
      txPowerLevel: advertisement.txPowerLevel,
      serviceUuids: advertisement.serviceUuids,
      manufacturerData: (advertisement.manufacturerData ? new Buffer(advertisement.manufacturerData, 'hex') : null),
      serviceData: (advertisement.serviceData ? new Buffer(advertisement.serviceData, 'hex') : null)
    };

    this._peripherals[peripheralUuid] = {
      uuid: peripheralUuid,
      advertisement: advertisement,
      rssi: rssi
    };

    this.emit('discover', peripheralUuid, advertisement, rssi);
  } else if (type === 'connect') {
    this.emit('connect', peripheralUuid);
  } else if (type === 'disconnect') {
    this.emit('disconnect', peripheralUuid);
  } else if (type === 'rssiUpdate') {
    this.emit('rssiUpdate', peripheralUuid, rssi);
  } else if (type === 'servicesDiscover') {
    this.emit('servicesDiscover', peripheralUuid, serviceUuids);
  } else if (type === 'includedServicesDiscover') {
    this.emit('includedServicesDiscover', peripheralUuid, serviceUuid, includedServiceUuids);
  } else if (type === 'characteristicsDiscover') {
    this.emit('characteristicsDiscover', peripheralUuid, serviceUuid, characteristics);
  } else if (type === 'read') {
    this.emit('read', peripheralUuid, serviceUuid, characteristicUuid, data, isNotification);
  } else if (type === 'write') {
    this.emit('write', peripheralUuid, serviceUuid, characteristicUuid);
  } else if (type === 'broadcast') {
    this.emit('broadcast', peripheralUuid, serviceUuid, characteristicUuid, state);
  } else if (type === 'notify') {
    this.emit('notify', peripheralUuid, serviceUuid, characteristicUuid, state);
  } else if (type === 'descriptorsDiscover') {
    this.emit('descriptorsDiscover', peripheralUuid, serviceUuid, characteristicUuid, descriptors);
  } else if (type === 'valueRead') {
    this.emit('valueRead', peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid, data);
  } else if (type === 'valueWrite') {
    this.emit('valueWrite', peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid);
  } else if (type === 'handleRead') {
    this.emit('handleRead', handle, data);
  } else if (type === 'handleWrite') {
    this.emit('handleWrite', handle);
  }
};

NobleBindings.prototype._sendCommand = function(command) {
  var message = JSON.stringify(command);

  this._ws.send(message);
};

NobleBindings.prototype.startScanning = function(serviceUuids, allowDuplicates) {
  this._startScanCommand = {
    action: 'startScanning',
    serviceUuids: serviceUuids,
    allowDuplicates: allowDuplicates
  };
  this._sendCommand(this._startScanCommand);

  this.emit('scanStart');
};

NobleBindings.prototype.stopScanning = function() {
  this._startScanCommand = null;

  this._sendCommand({
    action: 'stopScanning'
  });

  this.emit('scanStop');
};

NobleBindings.prototype.connect = function(deviceUuid) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'connect',
    peripheralUuid: peripheral.uuid
  });
};

NobleBindings.prototype.disconnect = function(deviceUuid) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'disconnect',
    peripheralUuid: peripheral.uuid
  });
};

NobleBindings.prototype.updateRssi = function(deviceUuid) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'updateRssi',
    peripheralUuid: peripheral.uuid
  });
};

NobleBindings.prototype.discoverServices = function(deviceUuid, uuids) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'discoverServices',
    peripheralUuid: peripheral.uuid,
    uuids: uuids
  });
};

NobleBindings.prototype.discoverIncludedServices = function(deviceUuid, serviceUuid, serviceUuids) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'discoverIncludedServices',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    serviceUuids: serviceUuids
  });
};

NobleBindings.prototype.discoverCharacteristics = function(deviceUuid, serviceUuid, characteristicUuids) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'discoverCharacteristics',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    characteristicUuids: characteristicUuids
  });
};

NobleBindings.prototype.read = function(deviceUuid, serviceUuid, characteristicUuid) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'read',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    characteristicUuid: characteristicUuid
  });
};

NobleBindings.prototype.write = function(deviceUuid, serviceUuid, characteristicUuid, data, withoutResponse) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'write',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    characteristicUuid: characteristicUuid,
    data: data.toString('hex'),
    withoutResponse: withoutResponse
  });
};

NobleBindings.prototype.broadcast = function(deviceUuid, serviceUuid, characteristicUuid, broadcast) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'broadcast',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    characteristicUuid: characteristicUuid,
    broadcast: broadcast
  });
};

NobleBindings.prototype.notify = function(deviceUuid, serviceUuid, characteristicUuid, notify) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'notify',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    characteristicUuid: characteristicUuid,
    notify: notify
  });
};

NobleBindings.prototype.discoverDescriptors = function(deviceUuid, serviceUuid, characteristicUuid) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'discoverDescriptors',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    characteristicUuid: characteristicUuid
  });
};

NobleBindings.prototype.readValue = function(deviceUuid, serviceUuid, characteristicUuid, descriptorUuid) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'readValue',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    characteristicUuid: characteristicUuid,
    descriptorUuid: descriptorUuid
  });
};

NobleBindings.prototype.writeValue = function(deviceUuid, serviceUuid, characteristicUuid, descriptorUuid, data) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'writeValue',
    peripheralUuid: peripheral.uuid,
    serviceUuid: serviceUuid,
    characteristicUuid: characteristicUuid,
    descriptorUuid: descriptorUuid,
    data: data.toString('hex')
  });
};

NobleBindings.prototype.readHandle = function(deviceUuid, handle) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'readHandle',
    peripheralUuid: peripheral.uuid,
    handle: handle
  });
};

NobleBindings.prototype.writeHandle = function(deviceUuid, handle, data, withoutResponse) {
  var peripheral = this._peripherals[deviceUuid];

  this._sendCommand({
    action: 'readHandle',
    peripheralUuid: peripheral.uuid,
    handle: handle,
    data: data.toString('hex'),
    withoutResponse: withoutResponse
  });
};

var nobleBindings = new NobleBindings();

module.exports = nobleBindings;

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/noble/lib/browser/websocket/bindings.js","/node_modules/noble/lib/browser/websocket")
},{"IrXUsu":10,"buffer":4,"debug":26,"events":7,"util":12,"ws":27}],18:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var debug = _dereq_('debug')('characteristic');

var events = _dereq_('events');
var util = _dereq_('util');

var characteristics = _dereq_('./characteristics.json');

function Characteristic(noble, peripheralUuid, serviceUuid, uuid, properties) {
  this._noble = noble;
  this._peripheralUuid = peripheralUuid;
  this._serviceUuid = serviceUuid;

  this.uuid = uuid;
  this.name = null;
  this.type = null;
  this.properties = properties;
  this.descriptors = null;

  var characteristic = characteristics[uuid];
  if (characteristic) {
    this.name = characteristic.name;
    this.type = characteristic.type;
  }
}

util.inherits(Characteristic, events.EventEmitter);

Characteristic.prototype.toString = function() {
  return JSON.stringify({
    uuid: this.uuid,
    name: this.name,
    type: this.type,
    properties: this.properties
  });
};

Characteristic.prototype.read = function(callback) {
  if (callback) {
    this.once('read', function(data) {
      callback(null, data);
    });
  }

  this._noble.read(
    this._peripheralUuid,
    this._serviceUuid,
    this.uuid
  );
};

Characteristic.prototype.write = function(data, withoutResponse, callback) {
  if (process.title !== 'browser') {
    if (!(data instanceof Buffer)) {
      throw new Error('data must be a Buffer');
    }
  }

  if (callback) {
    this.once('write', function() {
      callback(null);
    });
  }

  this._noble.write(
    this._peripheralUuid,
    this._serviceUuid,
    this.uuid,
    data,
    withoutResponse
  );
};

Characteristic.prototype.broadcast = function(broadcast, callback) {
  if (callback) {
    this.once('broadcast', function() {
      callback(null);
    });
  }

  this._noble.broadcast(
    this._peripheralUuid,
    this._serviceUuid,
    this.uuid,
    broadcast
  );
};

Characteristic.prototype.notify = function(notify, callback) {
  if (callback) {
    this.once('notify', function() {
      callback(null);
    });
  }

  this._noble.notify(
    this._peripheralUuid,
    this._serviceUuid,
    this.uuid,
    notify
  );
};

Characteristic.prototype.discoverDescriptors = function(callback) {
  if (callback) {
    this.once('descriptorsDiscover', function(descriptors) {
      callback(null, descriptors);
    });
  }

  this._noble.discoverDescriptors(
    this._peripheralUuid,
    this._serviceUuid,
    this.uuid
  );
};

module.exports = Characteristic;

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/noble/lib/characteristic.js","/node_modules/noble/lib")
},{"./characteristics.json":19,"IrXUsu":10,"buffer":4,"debug":26,"events":7,"util":12}],19:[function(_dereq_,module,exports){
module.exports={
    "2a00" : { "name" : "Device Name"
             , "type" : "org.bluetooth.characteristic.gap.device_name"
             }
  , "2a01" : { "name" : "Appearance"
             , "type" : "org.bluetooth.characteristic.gap.appearance"
             }
  , "2a02" : { "name" : "Peripheral Privacy Flag"
             , "type" : "org.bluetooth.characteristic.gap.peripheral_privacy_flag"
             }
  , "2a03" : { "name" : "Reconnection Address"
             , "type" : "org.bluetooth.characteristic.gap.reconnection_address"
             }
  , "2a04" : { "name" : "Peripheral Preferred Connection Parameters"
             , "type" : "org.bluetooth.characteristic.gap.peripheral_preferred_connection_parameters"
             }
  , "2a05" : { "name" : "Service Changed"
             , "type" : "org.bluetooth.characteristic.gatt.service_changed"
             }
  , "2a06" : { "name" : "Alert Level"
             , "type" : "org.bluetooth.characteristic.alert_level"
             }
  , "2a07" : { "name" : "Tx Power Level"
             , "type" : "org.bluetooth.characteristic.tx_power_level"
             }
  , "2a08" : { "name" : "Date Time"
             , "type" : "org.bluetooth.characteristic.date_time"
             }
  , "2a09" : { "name" : "Day of Week"
             , "type" : "org.bluetooth.characteristic.day_of_week"
             }
  , "2a0a" : { "name" : "Day Date Time"
             , "type" : "org.bluetooth.characteristic.day_date_time"
             }
  , "2a0c" : { "name" : "Exact Time 256"
             , "type" : "org.bluetooth.characteristic.exact_time_256"
             }
  , "2a0d" : { "name" : "DST Offset"
             , "type" : "org.bluetooth.characteristic.dst_offset"
             }
  , "2a0e" : { "name" : "Time Zone"
             , "type" : "org.bluetooth.characteristic.time_zone"
             }
  , "2a0f" : { "name" : "Local Time Information"
             , "type" : "org.bluetooth.characteristic.local_time_information"
             }
  , "2a11" : { "name" : "Time with DST"
             , "type" : "org.bluetooth.characteristic.time_with_dst"
             }
  , "2a12" : { "name" : "Time Accuracy"
             , "type" : "org.bluetooth.characteristic.time_accuracy"
             }
  , "2a13" : { "name" : "Time Source"
             , "type" : "org.bluetooth.characteristic.time_source"
             }
  , "2a14" : { "name" : "Reference Time Information"
             , "type" : "org.bluetooth.characteristic.reference_time_information"
             }
  , "2a16" : { "name" : "Time Update Control Point"
             , "type" : "org.bluetooth.characteristic.time_update_control_point"
             }
  , "2a17" : { "name" : "Time Update State"
             , "type" : "org.bluetooth.characteristic.time_update_state"
             }
  , "2a18" : { "name" : "Glucose Measurement"
             , "type" : "org.bluetooth.characteristic.glucose_measurement"
             }
  , "2a19" : { "name" : "Battery Level"
             , "type" : "org.bluetooth.characteristic.battery_level"
             }
  , "2a1c" : { "name" : "Temperature Measurement"
             , "type" : "org.bluetooth.characteristic.temperature_measurement"
             }
  , "2a1d" : { "name" : "Temperature Type"
             , "type" : "org.bluetooth.characteristic.temperature_type"
             }
  , "2a1e" : { "name" : "Intermediate Temperature"
             , "type" : "org.bluetooth.characteristic.intermediate_temperature"
             }
  , "2a21" : { "name" : "Measurement Interval"
             , "type" : "org.bluetooth.characteristic.measurement_interval"
             }
  , "2a22" : { "name" : "Boot Keyboard Input Report"
             , "type" : "org.bluetooth.characteristic.boot_keyboard_input_report"
             }
  , "2a23" : { "name" : "System ID"
             , "type" : "org.bluetooth.characteristic.system_id"
             }
  , "2a24" : { "name" : "Model Number String"
             , "type" : "org.bluetooth.characteristic.model_number_string"
             }
  , "2a25" : { "name" : "Serial Number String"
             , "type" : "org.bluetooth.characteristic.serial_number_string"
             }
  , "2a26" : { "name" : "Firmware Revision String"
             , "type" : "org.bluetooth.characteristic.firmware_revision_string"
             }
  , "2a27" : { "name" : "Hardware Revision String"
             , "type" : "org.bluetooth.characteristic.hardware_revision_string"
             }
  , "2a28" : { "name" : "Software Revision String"
             , "type" : "org.bluetooth.characteristic.software_revision_string"
             }
  , "2a29" : { "name" : "Manufacturer Name String"
             , "type" : "org.bluetooth.characteristic.manufacturer_name_string"
             }
  , "2a2a" : { "name" : "IEEE 11073-20601 Regulatory Certification Data List"
             , "type" : "org.bluetooth.characteristic.ieee_11073-20601_regulatory_certification_data_list"
             }
  , "2a2b" : { "name" : "Current Time"
             , "type" : "org.bluetooth.characteristic.current_time"
             }
  , "2a31" : { "name" : "Scan Refresh"
             , "type" : "org.bluetooth.characteristic.scan_refresh"
             }
  , "2a32" : { "name" : "Boot Keyboard Output Report"
             , "type" : "org.bluetooth.characteristic.boot_keyboard_output_report"
             }
  , "2a33" : { "name" : "Boot Mouse Input Report"
             , "type" : "org.bluetooth.characteristic.boot_mouse_input_report"
             }
  , "2a34" : { "name" : "Glucose Measurement Context"
             , "type" : "org.bluetooth.characteristic.glucose_measurement_context"
             }
  , "2a35" : { "name" : "Blood Pressure Measurement"
             , "type" : "org.bluetooth.characteristic.blood_pressure_measurement"
             }
  , "2a36" : { "name" : "Intermediate Cuff Pressure"
             , "type" : "org.bluetooth.characteristic.intermediate_blood_pressure"
             }
  , "2a37" : { "name" : "Heart Rate Measurement"
             , "type" : "org.bluetooth.characteristic.heart_rate_measurement"
             }
  , "2a38" : { "name" : "Body Sensor Location"
             , "type" : "org.bluetooth.characteristic.body_sensor_location"
             }
  , "2a39" : { "name" : "Heart Rate Control Point"
             , "type" : "org.bluetooth.characteristic.heart_rate_control_point"
             }
  , "2a3f" : { "name" : "Alert Status"
             , "type" : "org.bluetooth.characteristic.alert_status"
             }
  , "2a40" : { "name" : "Ringer Control Point"
             , "type" : "org.bluetooth.characteristic.ringer_control_point"
             }
  , "2a41" : { "name" : "Ringer Setting"
             , "type" : "org.bluetooth.characteristic.ringer_setting"
             }
  , "2a42" : { "name" : "Alert Category ID Bit Mask"
             , "type" : "org.bluetooth.characteristic.alert_category_id_bit_mask"
             }
  , "2a43" : { "name" : "Alert Category ID"
             , "type" : "org.bluetooth.characteristic.alert_category_id"
             }
  , "2a44" : { "name" : "Alert Notification Control Point"
             , "type" : "org.bluetooth.characteristic.alert_notification_control_point"
             }
  , "2a45" : { "name" : "Unread Alert Status"
             , "type" : "org.bluetooth.characteristic.unread_alert_status"
             }
  , "2a46" : { "name" : "New Alert"
             , "type" : "org.bluetooth.characteristic.new_alert"
             }
  , "2a47" : { "name" : "Supported New Alert Category"
             , "type" : "org.bluetooth.characteristic.supported_new_alert_category"
             }
  , "2a48" : { "name" : "Supported Unread Alert Category"
             , "type" : "org.bluetooth.characteristic.supported_unread_alert_category"
             }
  , "2a49" : { "name" : "Blood Pressure Feature"
             , "type" : "org.bluetooth.characteristic.blood_pressure_feature"
             }
  , "2a4a" : { "name" : "HID Information"
             , "type" : "org.bluetooth.characteristic.hid_information"
             }
  , "2a4b" : { "name" : "Report Map"
             , "type" : "org.bluetooth.characteristic.report_map"
             }
  , "2a4c" : { "name" : "HID Control Point"
             , "type" : "org.bluetooth.characteristic.hid_control_point"
             }
  , "2a4d" : { "name" : "Report"
             , "type" : "org.bluetooth.characteristic.report"
             }
  , "2a4e" : { "name" : "Protocol Mode"
             , "type" : "org.bluetooth.characteristic.protocol_mode"
             }
  , "2a4f" : { "name" : "Scan Interval Window"
             , "type" : "org.bluetooth.characteristic.scan_interval_window"
             }
  , "2a50" : { "name" : "PnP ID"
             , "type" : "org.bluetooth.characteristic.pnp_id"
             }
  , "2a51" : { "name" : "Glucose Feature"
             , "type" : "org.bluetooth.characteristic.glucose_feature"
             }
  , "2a52" : { "name" : "Record Access Control Point"
             , "type" : "org.bluetooth.characteristic.record_access_control_point"
             }
  , "2a53" : { "name" : "RSC Measurement"
             , "type" : "org.bluetooth.characteristic.rsc_measurement"
             }
  , "2a54" : { "name" : "RSC Feature"
             , "type" : "org.bluetooth.characteristic.rsc_feature"
             }
  , "2a55" : { "name" : "SC Control Point"
             , "type" : "org.bluetooth.characteristic.sc_control_point"
             }
  , "2a5b" : { "name" : "CSC Measurement"
             , "type" : "org.bluetooth.characteristic.csc_measurement"
             }
  , "2a5c" : { "name" : "CSC Feature"
             , "type" : "org.bluetooth.characteristic.csc_feature"
             }
  , "2a5d" : { "name" : "Sensor Location"
             , "type" : "org.bluetooth.characteristic.sensor_location"
             }
}
},{}],20:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var debug = _dereq_('debug')('descriptor');

var events = _dereq_('events');
var util = _dereq_('util');

var descriptors = _dereq_('./descriptors.json');

function Descriptor(noble, peripheralUuid, serviceUuid, characteristicUuid, uuid) {
  this._noble = noble;
  this._peripheralUuid = peripheralUuid;
  this._serviceUuid = serviceUuid;
  this._characteristicUuid = characteristicUuid;

  this.uuid = uuid;
  this.name = null;
  this.type = null;

  var descriptor = descriptors[uuid];
  if (descriptor) {
    this.name = descriptor.name;
    this.type = descriptor.type;
  }
}

util.inherits(Descriptor, events.EventEmitter);

Descriptor.prototype.toString = function() {
  return JSON.stringify({
    uuid: this.uuid,
    name: this.name,
    type: this.type
  });
};

Descriptor.prototype.readValue = function(callback) {
  if (callback) {
    this.on('valueRead', function(data) {
      callback(null, data);
    });
  }
  this._noble.readValue(
    this._peripheralUuid,
    this._serviceUuid,
    this._characteristicUuid,
    this.uuid
  );
};

Descriptor.prototype.writeValue = function(data, callback) {
  if (!(data instanceof Buffer)) {
    throw new Error('data must be a Buffer');
  }

  if (callback) {
    this.on('valueWrite', function() {
      callback(null);
    });
  }
  this._noble.writeValue(
    this._peripheralUuid,
    this._serviceUuid,
    this._characteristicUuid,
    this.uuid,
    data
  );
};

module.exports = Descriptor;

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/noble/lib/descriptor.js","/node_modules/noble/lib")
},{"./descriptors.json":21,"IrXUsu":10,"buffer":4,"debug":26,"events":7,"util":12}],21:[function(_dereq_,module,exports){
module.exports={
    "2900" : { "name" : "Characteristic Extended Properties"
             , "type" : "org.bluetooth.descriptor.gatt.characteristic_extended_properties"
       }
  , "2901" : { "name" : "Characteristic User Description"
             , "type" : "org.bluetooth.descriptor.gatt.characteristic_user_description"
       }
  , "2902" : { "name" : "Client Characteristic Configuration"
             , "type" : "org.bluetooth.descriptor.gatt.client_characteristic_configuration"
       }
  , "2903" : { "name" : "Server Characteristic Configuration"
             , "type" : "org.bluetooth.descriptor.gatt.server_characteristic_configuration"
       }
  , "2904" : { "name" : "Characteristic Presentation Format"
             , "type" : "org.bluetooth.descriptor.gatt.characteristic_presentation_format"
       }
  , "2905" : { "name" : "Characteristic Aggregate Format"
             , "type" : "org.bluetooth.descriptor.gatt.characteristic_aggregate_format"
       }
  , "2906" : { "name" : "Valid Range"
             , "type" : "org.bluetooth.descriptor.valid_range"
       }
  , "2907" : { "name" : "External Report Reference"
             , "type" : "org.bluetooth.descriptor.external_report_reference"
       }
  , "2908" : { "name" : "Report Reference"
             , "type" : "org.bluetooth.descriptor.report_reference"
       }
}
},{}],22:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var debug = _dereq_('debug')('noble');

var events = _dereq_('events');
var os = _dereq_('os');
var util = _dereq_('util');

var Peripheral = _dereq_('./peripheral');
var Service = _dereq_('./service');
var Characteristic = _dereq_('./characteristic');
var Descriptor = _dereq_('./descriptor');

var bindings = null;

var platform = os.platform();

if (process.env.NOBLE_WEBSOCKET || process.title === 'browser') {
  bindings = _dereq_('./browser');
} else if (process.env.NOBLE_DISTRIBUTED) {
  bindings = _dereq_('./distributed/bindings');
} else if (platform === 'darwin') {
  bindings = _dereq_('./mac/bindings');
} else if (platform === 'linux') {
  bindings = _dereq_('./linux/bindings');
} else {
  throw new Error('Unsupported platform');
}

function Noble() {
  this.state = 'unknown';

  this._bindings = bindings;
  this._peripherals = {};
  this._services = {};
  this._characteristics = {};
  this._descriptors = {};

  this._bindings.on('stateChange', this.onStateChange.bind(this));
  this._bindings.on('scanStart', this.onScanStart.bind(this));
  this._bindings.on('scanStop', this.onScanStop.bind(this));
  this._bindings.on('discover', this.onDiscover.bind(this));
  this._bindings.on('connect', this.onConnect.bind(this));
  this._bindings.on('disconnect', this.onDisconnect.bind(this));
  this._bindings.on('rssiUpdate', this.onRssiUpdate.bind(this));
  this._bindings.on('servicesDiscover', this.onServicesDiscover.bind(this));
  this._bindings.on('includedServicesDiscover', this.onIncludedServicesDiscover.bind(this));
  this._bindings.on('characteristicsDiscover', this.onCharacteristicsDiscover.bind(this));
  this._bindings.on('read', this.onRead.bind(this));
  this._bindings.on('write', this.onWrite.bind(this));
  this._bindings.on('broadcast', this.onBroadcast.bind(this));
  this._bindings.on('notify', this.onNotify.bind(this));
  this._bindings.on('descriptorsDiscover', this.onDescriptorsDiscover.bind(this));
  this._bindings.on('valueRead', this.onValueRead.bind(this));
  this._bindings.on('valueWrite', this.onValueWrite.bind(this));
  this._bindings.on('handleRead', this.onHandleRead.bind(this));
  this._bindings.on('handleWrite', this.onHandleWrite.bind(this));
  this._bindings.on('handleNotify', this.onHandleNotify.bind(this));
}

util.inherits(Noble, events.EventEmitter);

Noble.prototype.onStateChange = function(state) {
  debug('stateChange ' + state);

  this.state = state;

  this.emit('stateChange', state);
};

Noble.prototype.startScanning = function(serviceUuids, allowDuplicates, callback) {
  if (callback) {
    this.once('scanStart', callback);
  }

  this._discoveredPeripheralUUids = [];
  this._allowDuplicates = allowDuplicates;

  this._bindings.startScanning(serviceUuids, allowDuplicates);
};

Noble.prototype.onScanStart = function() {
  debug('scanStart');
  this.emit('scanStart');
};

Noble.prototype.stopScanning = function(callback) {
  if (callback) {
    this.once('scanStop', callback);
  }
  this._bindings.stopScanning();
};

Noble.prototype.onScanStop = function() {
  debug('scanStop');
  this.emit('scanStop');
};

Noble.prototype.onDiscover = function(uuid, advertisement, rssi) {
  var peripheral = this._peripherals[uuid];

  if (!peripheral) {
    peripheral = new Peripheral(this, uuid, advertisement, rssi);

    this._peripherals[uuid] = peripheral;
    this._services[uuid] = {};
    this._characteristics[uuid] = {};
    this._descriptors[uuid] = {};
  } else {
    // "or" the advertisment data with existing
    for (var i in advertisement) {
      if (advertisement[i] !== undefined) {
        peripheral.advertisement[i] = advertisement[i];
      }
    }

    peripheral.rssi = rssi;
  }

  var previouslyDiscoverd = (this._discoveredPeripheralUUids.indexOf(uuid) !== -1);

  if (!previouslyDiscoverd) {
    this._discoveredPeripheralUUids.push(uuid);
  }

  if (this._allowDuplicates || !previouslyDiscoverd) {
    this.emit('discover', peripheral);
  }
};

Noble.prototype.connect = function(peripheralUuid) {
  this._bindings.connect(peripheralUuid);
};

Noble.prototype.onConnect = function(peripheralUuid, error) {
  var peripheral = this._peripherals[peripheralUuid];

  if (peripheral) {
    peripheral.state = 'connected';
    peripheral.emit('connect', error);
  } else {
    console.warn('noble: unknown peripheral ' + peripheralUuid + ' connected!');
  }
};

Noble.prototype.disconnect = function(peripheralUuid) {
  this._bindings.disconnect(peripheralUuid);
};

Noble.prototype.onDisconnect = function(peripheralUuid) {
  var peripheral = this._peripherals[peripheralUuid];

  if (peripheral) {
    peripheral.state = 'disconnected';
    peripheral.emit('disconnect');
  } else {
    console.warn('noble: unknown peripheral ' + peripheralUuid + ' disconnected!');
  }
};

Noble.prototype.updateRssi = function(peripheralUuid) {
  this._bindings.updateRssi(peripheralUuid);
};

Noble.prototype.onRssiUpdate = function(peripheralUuid, rssi) {
  var peripheral = this._peripherals[peripheralUuid];

  if (peripheral) {
    peripheral.rssi = rssi;

    peripheral.emit('rssiUpdate', rssi);
  } else {
    console.warn('noble: unknown peripheral ' + peripheralUuid + ' RSSI update!');
  }
};

Noble.prototype.discoverServices = function(peripheralUuid, uuids) {
  this._bindings.discoverServices(peripheralUuid, uuids);
};

Noble.prototype.onServicesDiscover = function(peripheralUuid, serviceUuids) {
  var peripheral = this._peripherals[peripheralUuid];

  if (peripheral) {
    var services = [];

    for (var i = 0; i < serviceUuids.length; i++) {
      var serviceUuid = serviceUuids[i];
      var service = new Service(this, peripheralUuid, serviceUuid);

      this._services[peripheralUuid][serviceUuid] = service;
      this._characteristics[peripheralUuid][serviceUuid] = {};
      this._descriptors[peripheralUuid][serviceUuid] = {};

      services.push(service);
    }

    peripheral.services = services;

    peripheral.emit('servicesDiscover', services);
  } else {
    console.warn('noble: unknown peripheral ' + peripheralUuid + ' services discover!');
  }
};

Noble.prototype.discoverIncludedServices = function(peripheralUuid, serviceUuid, serviceUuids) {
  this._bindings.discoverIncludedServices(peripheralUuid, serviceUuid, serviceUuids);
};

Noble.prototype.onIncludedServicesDiscover = function(peripheralUuid, serviceUuid, includedServiceUuids) {
  var service = this._services[peripheralUuid][serviceUuid];

  if (service) {
    service.includedServiceUuids = includedServiceUuids;

    service.emit('includedServicesDiscover', includedServiceUuids);
  } else {
    console.warn('noble: unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ' included services discover!');
  }
};

Noble.prototype.discoverCharacteristics = function(peripheralUuid, serviceUuid, characteristicUuids) {
  this._bindings.discoverCharacteristics(peripheralUuid, serviceUuid, characteristicUuids);
};

Noble.prototype.onCharacteristicsDiscover = function(peripheralUuid, serviceUuid, characteristics) {
  var service = this._services[peripheralUuid][serviceUuid];

  if (service) {
    var characteristics_ = [];

    for (var i = 0; i < characteristics.length; i++) {
      var characteristicUuid = characteristics[i].uuid;

      var characteristic = new Characteristic(
                                this,
                                peripheralUuid,
                                serviceUuid,
                                characteristicUuid,
                                characteristics[i].properties
                            );

      this._characteristics[peripheralUuid][serviceUuid][characteristicUuid] = characteristic;
      this._descriptors[peripheralUuid][serviceUuid][characteristicUuid] = {};

      characteristics_.push(characteristic);
    }

    service.characteristics = characteristics_;

    service.emit('characteristicsDiscover', characteristics_);
  } else {
    console.warn('noble: unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ' characteristics discover!');
  }
};

Noble.prototype.read = function(peripheralUuid, serviceUuid, characteristicUuid) {
   this._bindings.read(peripheralUuid, serviceUuid, characteristicUuid);
};

Noble.prototype.onRead = function(peripheralUuid, serviceUuid, characteristicUuid, data, isNotification) {
  var characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

  if (characteristic) {
    characteristic.emit('read', data, isNotification);
  } else {
    console.warn('noble: unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ', ' + characteristicUuid + ' read!');
  }
};

Noble.prototype.write = function(peripheralUuid, serviceUuid, characteristicUuid, data, withoutResponse) {
   this._bindings.write(peripheralUuid, serviceUuid, characteristicUuid, data, withoutResponse);
};

Noble.prototype.onWrite = function(peripheralUuid, serviceUuid, characteristicUuid) {
  var characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

  if (characteristic) {
    characteristic.emit('write');
  } else {
    console.warn('noble: unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ', ' + characteristicUuid + ' write!');
  }
};

Noble.prototype.broadcast = function(peripheralUuid, serviceUuid, characteristicUuid, broadcast) {
   this._bindings.broadcast(peripheralUuid, serviceUuid, characteristicUuid, broadcast);
};

Noble.prototype.onBroadcast = function(peripheralUuid, serviceUuid, characteristicUuid, state) {
  var characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

  if (characteristic) {
    characteristic.emit('broadcast', state);
  } else {
    console.warn('noble: unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ', ' + characteristicUuid + ' broadcast!');
  }
};

Noble.prototype.notify = function(peripheralUuid, serviceUuid, characteristicUuid, notify) {
   this._bindings.notify(peripheralUuid, serviceUuid, characteristicUuid, notify);
};

Noble.prototype.onNotify = function(peripheralUuid, serviceUuid, characteristicUuid, state) {
  var characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

  if (characteristic) {
    characteristic.emit('notify', state);
  } else {
    console.warn('noble: unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ', ' + characteristicUuid + ' notify!');
  }
};

Noble.prototype.discoverDescriptors = function(peripheralUuid, serviceUuid, characteristicUuid) {
  this._bindings.discoverDescriptors(peripheralUuid, serviceUuid, characteristicUuid);
};

Noble.prototype.onDescriptorsDiscover = function(peripheralUuid, serviceUuid, characteristicUuid, descriptors) {
  var characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

  if (characteristic) {
    var descriptors_ = [];

    for (var i = 0; i < descriptors.length; i++) {
      var descriptorUuid = descriptors[i];

      var descriptor = new Descriptor(
                            this,
                            peripheralUuid,
                            serviceUuid,
                            characteristicUuid,
                            descriptorUuid
                        );

      this._descriptors[peripheralUuid][serviceUuid][characteristicUuid][descriptorUuid] = descriptor;

      descriptors_.push(descriptor);
    }

    characteristic.descriptors = descriptors_;

    characteristic.emit('descriptorsDiscover', descriptors_);
  } else {
    console.warn('noble: unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ', ' + characteristicUuid + ' descriptors discover!');
  }
};

Noble.prototype.readValue = function(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid) {
  this._bindings.readValue(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid);
};

Noble.prototype.onValueRead = function(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid, data) {
  var descriptor = this._descriptors[peripheralUuid][serviceUuid][characteristicUuid][descriptorUuid];

  if (descriptor) {
    descriptor.emit('valueRead', data);
  } else {
    console.warn('noble: unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ', ' + characteristicUuid + ', ' + descriptorUuid + ' value read!');
  }
};

Noble.prototype.writeValue = function(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid, data) {
  this._bindings.writeValue(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid, data);
};

Noble.prototype.onValueWrite = function(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid) {
  var descriptor = this._descriptors[peripheralUuid][serviceUuid][characteristicUuid][descriptorUuid];

  if (descriptor) {
    descriptor.emit('valueWrite');
  } else {
    console.warn('noble: unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ', ' + characteristicUuid + ', ' + descriptorUuid + ' value write!');
  }
};

Noble.prototype.readHandle = function(peripheralUuid, handle) {
  this._bindings.readHandle(peripheralUuid, handle);
};

Noble.prototype.onHandleRead = function(peripheralUuid, handle, data) {
  var peripheral = this._peripherals[peripheralUuid];

  if (peripheral) {
    peripheral.emit('handleRead' + handle, data);
  } else {
    console.warn('noble: unknown peripheral ' + peripheralUuid + ' handle read!');
  }
};

Noble.prototype.writeHandle = function(peripheralUuid, handle, data, withoutResponse) {
  this._bindings.writeHandle(peripheralUuid, handle, data, withoutResponse);
};

Noble.prototype.onHandleWrite = function(peripheralUuid, handle) {
  var peripheral = this._peripherals[peripheralUuid];

  if (peripheral) {
    peripheral.emit('handleWrite' + handle);
  } else {
    console.warn('noble: unknown peripheral ' + peripheralUuid + ' handle write!');
  }
};

Noble.prototype.onHandleNotify = function(peripheralUuid, handle, data) {
  var peripheral = this._peripherals[peripheralUuid];

  if (peripheral) {
    peripheral.emit('handleNotify', handle, data);
  } else {
    console.warn('noble: unknown peripheral ' + peripheralUuid + ' handle notify!');
  }
};

module.exports = Noble;

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/noble/lib/noble.js","/node_modules/noble/lib")
},{"./browser":15,"./characteristic":18,"./descriptor":20,"./distributed/bindings":3,"./linux/bindings":3,"./mac/bindings":3,"./peripheral":23,"./service":24,"IrXUsu":10,"buffer":4,"debug":26,"events":7,"os":9,"util":12}],23:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*jshint loopfunc: true */
var debug = _dereq_('debug')('peripheral');

var events = _dereq_('events');
var util = _dereq_('util');

function Peripheral(noble, uuid, advertisement, rssi) {
  this._noble = noble;

  this.uuid = uuid;
  this.advertisement = advertisement;
  this.rssi = rssi;
  this.services = null;
  this.state = 'disconnected';
}

util.inherits(Peripheral, events.EventEmitter);

Peripheral.prototype.toString = function() {
  return JSON.stringify({
    uuid: this.uuid,
    advertisement: this.advertisement,
    rssi: this.rssi,
    state: this.state
  });
};

Peripheral.prototype.connect = function(callback) {
  if (callback) {
    this.once('connect', function(error) {
      callback(error);
    });
  }
  
  if (this.state === 'connected') {
    this.emit('connect', new Error('Peripheral already connected'));
  } else {
    this.state = 'connecting';
    this._noble.connect(this.uuid);
  }
};

Peripheral.prototype.disconnect = function(callback) {
  if (callback) {
    this.once('disconnect', function() {
      callback(null);
    });
  }
  this.state = 'disconnecting';
  this._noble.disconnect(this.uuid);
};

Peripheral.prototype.updateRssi = function(callback) {
  if (callback) {
    this.once('rssiUpdate', function(rssi) {
      callback(null, rssi);
    });
  }

  this._noble.updateRssi(this.uuid);
};

Peripheral.prototype.discoverServices = function(uuids, callback) {
  if (callback) {
    this.once('servicesDiscover', function(services) {
      callback(null, services);
    });
  }

  this._noble.discoverServices(this.uuid, uuids);
};

Peripheral.prototype.discoverSomeServicesAndCharacteristics = function(serviceUuids, characteristicsUuids, callback) {
  this.discoverServices(serviceUuids, function(err, services) {
    var numDiscovered = 0;
    var allCharacteristics = [];

    for (var i in services) {
      var service = services[i];

      service.discoverCharacteristics(characteristicsUuids, function(error, characteristics) {
        numDiscovered++;

        if (error === null) {
          for (var j in characteristics) {
            var characteristic = characteristics[j];

            allCharacteristics.push(characteristic);
          }
        }

        if (numDiscovered === services.length) {
          if (callback) {
            callback(null, services, allCharacteristics);
          }
        }
      }.bind(this));
    }
  }.bind(this));
};

Peripheral.prototype.discoverAllServicesAndCharacteristics = function(callback) {
  this.discoverSomeServicesAndCharacteristics([], [], callback);
};

Peripheral.prototype.readHandle = function(handle, callback) {
  if (callback) {
    this.once('handleRead' + handle, function(data) {
      callback(null, data);
    });
  }

  this._noble.readHandle(this.uuid, handle);
};

Peripheral.prototype.writeHandle = function(handle, data, withoutResponse, callback) {
  if (!(data instanceof Buffer)) {
    throw new Error('data must be a Buffer');
  }
  
  if (callback) {
    this.once('handleWrite' + handle, function() {
      callback(null);
    });
  }

  this._noble.writeHandle(this.uuid, handle, data, withoutResponse);
};

module.exports = Peripheral;

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/noble/lib/peripheral.js","/node_modules/noble/lib")
},{"IrXUsu":10,"buffer":4,"debug":26,"events":7,"util":12}],24:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var debug = _dereq_('debug')('service');

var events = _dereq_('events');
var util = _dereq_('util');

var services = _dereq_('./services.json');

function Service(noble, peripheralUuid, uuid) {
  this._noble = noble;
  this._peripheralUuid = peripheralUuid;

  this.uuid = uuid;
  this.name = null;
  this.type = null;
  this.includedServiceUuids = null;
  this.characteristics = null;

  var service = services[uuid];
  if (service) {
    this.name = service.name;
    this.type = service.type;
  }
}

util.inherits(Service, events.EventEmitter);

Service.prototype.toString = function() {
  return JSON.stringify({
    uuid: this.uuid,
    name: this.name,
    type: this.type,
    includedServiceUuids: this.includedServiceUuids
  });
};

Service.prototype.discoverIncludedServices = function(serviceUuids, callback) {
  if (callback) {
    this.once('includedServicesDiscover', function(includedServiceUuids) {
      callback(null, includedServiceUuids);
    });
  }

  this._noble.discoverIncludedServices(
    this._peripheralUuid,
    this.uuid,
    serviceUuids
  );
};

Service.prototype.discoverCharacteristics = function(characteristicUuids, callback) {
  if (callback) {
    this.once('characteristicsDiscover', function(characteristics) {
      callback(null, characteristics);
    });
  }

  this._noble.discoverCharacteristics(
    this._peripheralUuid,
    this.uuid,
    characteristicUuids
  );
};

module.exports = Service;

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/noble/lib/service.js","/node_modules/noble/lib")
},{"./services.json":25,"IrXUsu":10,"buffer":4,"debug":26,"events":7,"util":12}],25:[function(_dereq_,module,exports){
module.exports={
    "1800" : { "name" : "Generic Access"
             , "type" : "org.bluetooth.service.generic_access"
             }
  , "1801" : { "name" : "Generic Attribute"
             , "type" : "org.bluetooth.service.generic_attribute"
             }
  , "1802" : { "name" : "Immediate Alert"
             , "type" : "org.bluetooth.service.immediate_alert"
             }
  , "1803" : { "name" : "Link Loss"
             , "type" : "org.bluetooth.service.link_loss"
             }
  , "1804" : { "name" : "Tx Power"
             , "type" : "org.bluetooth.service.tx_power"
             }
  , "1805" : { "name" : "Current Time Service"
             , "type" : "org.bluetooth.service.current_time"
             }
  , "1806" : { "name" : "Reference Time Update Service"
             , "type" : "org.bluetooth.service.reference_time_update"
             }
  , "1807" : { "name" : "Next DST Change Service"
             , "type" : "org.bluetooth.service.next_dst_change"
             }
  , "1808" : { "name" : "Glucose"
             , "type" : "org.bluetooth.service.glucose"
             }
  , "1809" : { "name" : "Health Thermometer"
             , "type" : "org.bluetooth.service.health_thermometer"
             }
  , "180a" : { "name" : "Device Information"
             , "type" : "org.bluetooth.service.device_information"
             }
  , "180d" : { "name" : "Heart Rate"
             , "type" : "org.bluetooth.service.heart_rate"
             }
  , "180e" : { "name" : "Phone Alert Status Service"
             , "type" : "org.bluetooth.service.phone_alert_service"
             }
  , "180f" : { "name" : "Battery Service"
             , "type" : "org.bluetooth.service.battery_service"
             }
  , "1810" : { "name" : "Blood Pressure"
             , "type" : "org.bluetooth.service.blood_pressuer"
             }
  , "1811" : { "name" : "Alert Notification Service"
             , "type" : "org.bluetooth.service.alert_notification"
             }
  , "1812" : { "name" : "Human Interface Device"
             , "type" : "org.bluetooth.service.human_interface_device"
             }
  , "1813" : { "name" : "Scan Parameters"
             , "type" : "org.bluetooth.service.scan_parameters"
             }
  , "1814" : { "name" : "Running Speed and Cadence"
             , "type" : "org.bluetooth.service.running_speed_and_cadence"
             }
  , "1815" : { "name" : "Cycling Speed and Cadence"
             , "type" : "org.bluetooth.service.cycling_speed_and_cadence"
             }
}
},{}],26:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){

/**
 * Expose `debug()` as the module.
 */

module.exports = debug;

/**
 * Create a debugger with the given `name`.
 *
 * @param {String} name
 * @return {Type}
 * @api public
 */

function debug(name) {
  if (!debug.enabled(name)) return function(){};

  return function(fmt){
    fmt = coerce(fmt);

    var curr = new Date;
    var ms = curr - (debug[name] || curr);
    debug[name] = curr;

    fmt = name
      + ' '
      + fmt
      + ' +' + debug.humanize(ms);

    // This hackery is required for IE8
    // where `console.log` doesn't have 'apply'
    window.console
      && console.log
      && Function.prototype.apply.call(console.log, console, arguments);
  }
}

/**
 * The currently active debug mode names.
 */

debug.names = [];
debug.skips = [];

/**
 * Enables a debug mode by name. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} name
 * @api public
 */

debug.enable = function(name) {
  try {
    localStorage.debug = name;
  } catch(e){}

  var split = (name || '').split(/[\s,]+/)
    , len = split.length;

  for (var i = 0; i < len; i++) {
    name = split[i].replace('*', '.*?');
    if (name[0] === '-') {
      debug.skips.push(new RegExp('^' + name.substr(1) + '$'));
    }
    else {
      debug.names.push(new RegExp('^' + name + '$'));
    }
  }
};

/**
 * Disable debug output.
 *
 * @api public
 */

debug.disable = function(){
  debug.enable('');
};

/**
 * Humanize the given `ms`.
 *
 * @param {Number} m
 * @return {String}
 * @api private
 */

debug.humanize = function(ms) {
  var sec = 1000
    , min = 60 * 1000
    , hour = 60 * min;

  if (ms >= hour) return (ms / hour).toFixed(1) + 'h';
  if (ms >= min) return (ms / min).toFixed(1) + 'm';
  if (ms >= sec) return (ms / sec | 0) + 's';
  return ms + 'ms';
};

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

debug.enabled = function(name) {
  for (var i = 0, len = debug.skips.length; i < len; i++) {
    if (debug.skips[i].test(name)) {
      return false;
    }
  }
  for (var i = 0, len = debug.names.length; i < len; i++) {
    if (debug.names[i].test(name)) {
      return true;
    }
  }
  return false;
};

/**
 * Coerce `val`.
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

// persist

try {
  if (window.localStorage) debug.enable(localStorage.debug);
} catch(e){}

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/noble/node_modules/debug/debug.js","/node_modules/noble/node_modules/debug")
},{"IrXUsu":10,"buffer":4}],27:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){

/**
 * Module dependencies.
 */

var global = (function() { return this; })();

/**
 * WebSocket constructor.
 */

var WebSocket = global.WebSocket || global.MozWebSocket;

/**
 * Module exports.
 */

module.exports = WebSocket ? ws : null;

/**
 * WebSocket constructor.
 *
 * The third `opts` options object gets ignored in web browsers, since it's
 * non-standard, and throws a TypeError if passed to the constructor.
 * See: https://github.com/einaros/ws/issues/227
 *
 * @param {String} uri
 * @param {Array} protocols (optional)
 * @param {Object) opts (optional)
 * @api public
 */

function ws(uri, protocols, opts) {
  var instance;
  if (protocols) {
    instance = new WebSocket(uri, protocols);
  } else {
    instance = new WebSocket(uri);
  }
  return instance;
}

if (WebSocket) ws.prototype = WebSocket.prototype;

}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/ws/lib/browser.js","/node_modules/ws/lib")
},{"IrXUsu":10,"buffer":4}],28:[function(_dereq_,module,exports){
module.exports={
  "name": "skynet-heartbeat",
  "version": "0.2.0",
  "description": "Skynet Gateblu and Mobiblu Heartbeat plugin",
  "main": "index.js",
  "scripts": {
    "test": "mocha"
  },
  "repository": {
    "type": "git",
    "url": "git://github.com/peterdemartini/skynet-heartbeat.git"
  },
  "keywords": [
    "Mobiblu",
    "Gateblu",
    "Skynet",
    "Meshblu"
  ],
  "author": "Peter DeMartini",
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/peterdemartini/skynet-heartbeat/issues"
  },
  "homepage": "https://github.com/peterdemartini/skynet-heartbeat",
  "devDependencies": {
    "gulp-rename": "~1.2.0",
    "gulp": "~3.8.7",
    "gulp-uglify": "~1.0.0",
    "gulp-browserify": "~0.5.0",
    "mocha": "~1.21.4"
  },
  "dependencies": {
    "noble": "git://github.com/octoblu/noble",
    "ws": "~0.4.32"
  }
}

},{}],29:[function(_dereq_,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var noble = _dereq_('noble');

function Scanner(timeout, serviceUuids, done, logIt) {
	var self = this, peripheral;

	self.logIt = logIt;

	self.timeout = null;

	function stopScanning() {
		clearTimeout(self.timeout);
	  noble.stopScanning();
	  noble.removeAllListeners('discover');
	  if(!peripheral){
	  	self.logEvent(null, 'Stop Scanning for BLE devices...');
	  }
	  done(peripheral);
	}

  noble.on('discover', function (_peripheral) {
	  self.logEvent(null, 'Found Heartbeat Device : ' + _peripheral.advertisement.localName);
	  if (_peripheral) {
	  	peripheral = _peripheral;
	    stopScanning();
	  } else {
	    self.logEvent('Invalid Peripheral');
	  }
	});
  if (!Array.isArray(serviceUuids)) {
    serviceUuids = [serviceUuids];
  }
  noble.startScanning(serviceUuids, true);

  self.logEvent(null, 'Scanning for Heartbeat Devices');
  self.timeout = setTimeout(stopScanning, timeout);
}

Scanner.prototype.logEvent = function (err, msg){
	console.log(err || msg);
 	this.logIt(err, msg);
};

module.exports = Scanner;
}).call(this,_dereq_("IrXUsu"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},_dereq_("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/scan.js","/")
},{"IrXUsu":10,"buffer":4,"noble":13}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9wZXRlci9Qcm9qZWN0cy9PY3RvYmx1L3NreW5ldC1oZWFydGJlYXQvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL1VzZXJzL3BldGVyL1Byb2plY3RzL09jdG9ibHUvc2t5bmV0LWhlYXJ0YmVhdC9mYWtlXzRkM2I0MDcyLmpzIiwiL1VzZXJzL3BldGVyL1Byb2plY3RzL09jdG9ibHUvc2t5bmV0LWhlYXJ0YmVhdC9oZWFydHJhdGUuanMiLCIvVXNlcnMvcGV0ZXIvUHJvamVjdHMvT2N0b2JsdS9za3luZXQtaGVhcnRiZWF0L25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcmVzb2x2ZS9lbXB0eS5qcyIsIi9Vc2Vycy9wZXRlci9Qcm9qZWN0cy9PY3RvYmx1L3NreW5ldC1oZWFydGJlYXQvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwiL1VzZXJzL3BldGVyL1Byb2plY3RzL09jdG9ibHUvc2t5bmV0LWhlYXJ0YmVhdC9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWIvYjY0LmpzIiwiL1VzZXJzL3BldGVyL1Byb2plY3RzL09jdG9ibHUvc2t5bmV0LWhlYXJ0YmVhdC9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCIvVXNlcnMvcGV0ZXIvUHJvamVjdHMvT2N0b2JsdS9za3luZXQtaGVhcnRiZWF0L25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiLCIvVXNlcnMvcGV0ZXIvUHJvamVjdHMvT2N0b2JsdS9za3luZXQtaGVhcnRiZWF0L25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2luaGVyaXRzL2luaGVyaXRzX2Jyb3dzZXIuanMiLCIvVXNlcnMvcGV0ZXIvUHJvamVjdHMvT2N0b2JsdS9za3luZXQtaGVhcnRiZWF0L25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL29zLWJyb3dzZXJpZnkvYnJvd3Nlci5qcyIsIi9Vc2Vycy9wZXRlci9Qcm9qZWN0cy9PY3RvYmx1L3NreW5ldC1oZWFydGJlYXQvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwiL1VzZXJzL3BldGVyL1Byb2plY3RzL09jdG9ibHUvc2t5bmV0LWhlYXJ0YmVhdC9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy91dGlsL3N1cHBvcnQvaXNCdWZmZXJCcm93c2VyLmpzIiwiL1VzZXJzL3BldGVyL1Byb2plY3RzL09jdG9ibHUvc2t5bmV0LWhlYXJ0YmVhdC9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy91dGlsL3V0aWwuanMiLCIvVXNlcnMvcGV0ZXIvUHJvamVjdHMvT2N0b2JsdS9za3luZXQtaGVhcnRiZWF0L25vZGVfbW9kdWxlcy9ub2JsZS9pbmRleC5qcyIsIi9Vc2Vycy9wZXRlci9Qcm9qZWN0cy9PY3RvYmx1L3NreW5ldC1oZWFydGJlYXQvbm9kZV9tb2R1bGVzL25vYmxlL2xpYi9icm93c2VyL2Nocm9tZS9iaW5kaW5ncy5qcyIsIi9Vc2Vycy9wZXRlci9Qcm9qZWN0cy9PY3RvYmx1L3NreW5ldC1oZWFydGJlYXQvbm9kZV9tb2R1bGVzL25vYmxlL2xpYi9icm93c2VyL2luZGV4LmpzIiwiL1VzZXJzL3BldGVyL1Byb2plY3RzL09jdG9ibHUvc2t5bmV0LWhlYXJ0YmVhdC9ub2RlX21vZHVsZXMvbm9ibGUvbGliL2Jyb3dzZXIvcGhvbmVnYXAvYmluZGluZ3MuanMiLCIvVXNlcnMvcGV0ZXIvUHJvamVjdHMvT2N0b2JsdS9za3luZXQtaGVhcnRiZWF0L25vZGVfbW9kdWxlcy9ub2JsZS9saWIvYnJvd3Nlci93ZWJzb2NrZXQvYmluZGluZ3MuanMiLCIvVXNlcnMvcGV0ZXIvUHJvamVjdHMvT2N0b2JsdS9za3luZXQtaGVhcnRiZWF0L25vZGVfbW9kdWxlcy9ub2JsZS9saWIvY2hhcmFjdGVyaXN0aWMuanMiLCIvVXNlcnMvcGV0ZXIvUHJvamVjdHMvT2N0b2JsdS9za3luZXQtaGVhcnRiZWF0L25vZGVfbW9kdWxlcy9ub2JsZS9saWIvY2hhcmFjdGVyaXN0aWNzLmpzb24iLCIvVXNlcnMvcGV0ZXIvUHJvamVjdHMvT2N0b2JsdS9za3luZXQtaGVhcnRiZWF0L25vZGVfbW9kdWxlcy9ub2JsZS9saWIvZGVzY3JpcHRvci5qcyIsIi9Vc2Vycy9wZXRlci9Qcm9qZWN0cy9PY3RvYmx1L3NreW5ldC1oZWFydGJlYXQvbm9kZV9tb2R1bGVzL25vYmxlL2xpYi9kZXNjcmlwdG9ycy5qc29uIiwiL1VzZXJzL3BldGVyL1Byb2plY3RzL09jdG9ibHUvc2t5bmV0LWhlYXJ0YmVhdC9ub2RlX21vZHVsZXMvbm9ibGUvbGliL25vYmxlLmpzIiwiL1VzZXJzL3BldGVyL1Byb2plY3RzL09jdG9ibHUvc2t5bmV0LWhlYXJ0YmVhdC9ub2RlX21vZHVsZXMvbm9ibGUvbGliL3BlcmlwaGVyYWwuanMiLCIvVXNlcnMvcGV0ZXIvUHJvamVjdHMvT2N0b2JsdS9za3luZXQtaGVhcnRiZWF0L25vZGVfbW9kdWxlcy9ub2JsZS9saWIvc2VydmljZS5qcyIsIi9Vc2Vycy9wZXRlci9Qcm9qZWN0cy9PY3RvYmx1L3NreW5ldC1oZWFydGJlYXQvbm9kZV9tb2R1bGVzL25vYmxlL2xpYi9zZXJ2aWNlcy5qc29uIiwiL1VzZXJzL3BldGVyL1Byb2plY3RzL09jdG9ibHUvc2t5bmV0LWhlYXJ0YmVhdC9ub2RlX21vZHVsZXMvbm9ibGUvbm9kZV9tb2R1bGVzL2RlYnVnL2RlYnVnLmpzIiwiL1VzZXJzL3BldGVyL1Byb2plY3RzL09jdG9ibHUvc2t5bmV0LWhlYXJ0YmVhdC9ub2RlX21vZHVsZXMvd3MvbGliL2Jyb3dzZXIuanMiLCIvVXNlcnMvcGV0ZXIvUHJvamVjdHMvT2N0b2JsdS9za3luZXQtaGVhcnRiZWF0L3BhY2thZ2UuanNvbiIsIi9Vc2Vycy9wZXRlci9Qcm9qZWN0cy9PY3RvYmx1L3NreW5ldC1oZWFydGJlYXQvc2Nhbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEpBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9TQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1a0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RhQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcFRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6TkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBoZWFydHJhdGUgPSByZXF1aXJlKCcuL2hlYXJ0cmF0ZScpO1xuXG5mdW5jdGlvbiBQbHVnaW4obWVzc2VuZ2VyLCBvcHRpb25zLCBhcGksIGRldmljZU5hbWUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZiAoIW9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0ge307XG4gIH1cbiAgaWYgKHR5cGVvZiBkZXZpY2VOYW1lID09PSAnc3RyaW5nJykge1xuICAgIHNlbGYubmFtZSA9IGRldmljZU5hbWU7XG4gIH0gZWxzZSBpZiAoZGV2aWNlTmFtZSkge1xuICAgIHNlbGYubmFtZSA9IGRldmljZU5hbWUubmFtZTtcbiAgICBzZWxmLnV1aWQgPSBkZXZpY2VOYW1lLnV1aWQ7XG4gIH0gZWxzZSB7XG4gICAgc2VsZi5uYW1lID0gcmVxdWlyZSgnLi9wYWNrYWdlLmpzb24nKS5uYW1lO1xuICAgIC8vIFVzZSBUZXN0IFVVSURcbiAgICBzZWxmLnV1aWQgPSAnZWdhOTg0ODEtM2Q0NS0xMWZPLTg5ODItNmI0YXNkNWY0c3NrYSc7XG4gIH1cblxuICBzZWxmLm1lc3NlbmdlciA9IG1lc3NlbmdlcjtcbiAgc2VsZi5vcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICBzZWxmLmFwaSA9IGFwaTsgLy8gTW9iaWxlIFNwZWNpZmljXG5cbiAgc2VsZi5tb2JpbGUgPSBmYWxzZTtcblxuICBpZiAoc2VsZi5hcGkgJiYgdHlwZW9mIHNlbGYuYXBpLmxvZ0FjdGl2aXR5ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgc2VsZi5tb2JpbGUgPSB0cnVlO1xuICB9XG5cbiAgdmFyIGxvZ0l0ID0gZnVuY3Rpb24oZXJyLCBtc2cpIHtcbiAgICB2YXIgb2JqID0ge1xuICAgICAgdHlwZTogc2VsZi5uYW1lXG4gICAgfTtcbiAgICBpZiAoZXJyKSB7XG4gICAgICBvYmouZXJyb3IgPSBlcnI7XG4gICAgfVxuICAgIGlmIChtc2cpIHtcbiAgICAgIG9iai5odG1sID0gbXNnO1xuICAgIH1cbiAgICBpZiAoc2VsZi5tb2JpbGUpIHtcbiAgICAgIHNlbGYuYXBpLmxvZ0FjdGl2aXR5KG9iaik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdsb2dJdCAoSGVhcnRSYXRlKTogJyArIEpTT04uc3RyaW5naWZ5KG9iaikpO1xuICAgIH1cbiAgfTtcblxuICBpZiAoIW9wdGlvbnMuYWRkcmVzc0tleSkge1xuICAgIG9wdGlvbnMuYWRkcmVzc0tleSA9ICdoZWFydF8nICsgc2VsZi51dWlkO1xuICB9XG5cbiAgZnVuY3Rpb24gbG9nSGVhcnRyYXRlKGhyKSB7XG4gICAgc2VsZi5tZXNzZW5nZXIuZGF0YSh7XG4gICAgICBkZXZpY2U6IHNlbGYubmFtZSxcbiAgICAgIHR5cGU6ICdoZWFydFJhdGUnLFxuICAgICAgaGVhcnRSYXRlOiBoclxuICAgIH0pO1xuICAgIGxvZ0l0KG51bGwsICdMb2dnZWQgSGVhcnRiZWF0IDogJyArIGhyKTtcbiAgfVxuXG4gIGhlYXJ0cmF0ZS5pbml0KG9wdGlvbnMsIHtcbiAgICBsb2dJdDogbG9nSXQsXG4gICAgbG9nSGVhcnRyYXRlOiBsb2dIZWFydHJhdGVcbiAgfSk7XG5cbiAgY29uc29sZS5sb2coJ0luaXRpYWxpemVkIEhlYXJ0UmF0ZSBQbHVnaW4nKTtcblxuICByZXR1cm4gc2VsZjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIFBsdWdpbjogUGx1Z2luXG59O1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJJclhVc3VcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9mYWtlXzRkM2I0MDcyLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgU2Nhbm5lciA9IHJlcXVpcmUoJy4vc2NhbicpO1xuXG52YXIgbGliID0ge30sXG4gIG9wdGlvbnMsXG4gIGFwaSxcbiAgc2VydmljZVV1aWQgPSAnMTgwZCcsXG4gIHNlcnZpY2VVdWlkcyA9IFtzZXJ2aWNlVXVpZF0sXG4gIGNoYXJhY3RlcmlzdGljVXVpZCA9ICcyYTM3JztcblxuZnVuY3Rpb24gc3RhcnRNb25pdG9yKGZuKSB7XG4gIG5ldyBTY2FubmVyKDI1ICogMTAwMCwgc2VydmljZVV1aWRzLCBmdW5jdGlvbihwZXJpcGhlcmFsKSB7XG4gIFx0aWYoIXBlcmlwaGVyYWwpe1xuICBcdFx0cmV0dXJuIGZuKHsgZXJyb3IgOiAnTm8gSGVhcnRSYXRlIE1vbml0b3IgRm91bmQnIH0pO1xuICBcdH1cbiAgICBmdW5jdGlvbiBnZXRIZWFydHJhdGUoZGF0YSkge1xuICAgICAgaWYgKGRhdGEgaW5zdGFuY2VvZiBVaW50OEFycmF5KSB7XG4gICAgICAgIHZhciBieXRlcyA9IGRhdGE7XG4gICAgICAgIC8vQ2hlY2sgZm9yIGRhdGFcbiAgICAgICAgaWYgKGJ5dGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdTdWJzY3JpcHRpb24gcmVzdWx0IGhhZCB6ZXJvIGxlbmd0aCBkYXRhJyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9HZXQgdGhlIGZpcnN0IGJ5dGUgdGhhdCBjb250YWlucyBmbGFnc1xuICAgICAgICB2YXIgZmxhZyA9IGJ5dGVzWzBdO1xuXG4gICAgICAgIC8vQ2hlY2sgaWYgdTggb3IgdTE2IGFuZCBnZXQgaGVhcnQgcmF0ZVxuICAgICAgICB2YXIgaHI7XG4gICAgICAgIGlmICgoZmxhZyAmIDB4MDEpID09PSAxKSB7XG4gICAgICAgICAgdmFyIHUxNmJ5dGVzID0gYnl0ZXMuYnVmZmVyLnNsaWNlKDEsIDMpO1xuICAgICAgICAgIHZhciB1MTYgPSBuZXcgVWludDE2QXJyYXkodTE2Ynl0ZXMpWzBdO1xuICAgICAgICAgIGhyID0gdTE2O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciB1OGJ5dGVzID0gYnl0ZXMuYnVmZmVyLnNsaWNlKDEsIDIpO1xuICAgICAgICAgIHZhciB1OCA9IG5ldyBVaW50OEFycmF5KHU4Ynl0ZXMpWzBdO1xuICAgICAgICAgIGhyID0gdTg7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGhyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGRhdGEucmVhZFVJbnQ4KDEpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uUmVhZChkYXRhKSB7XG4gICAgICBpZiAoZGF0YSkge1xuICAgICAgICB2YXIgb2JqID0ge1xuICAgICAgICAgIGhlYXJ0UmF0ZTogZ2V0SGVhcnRyYXRlKGRhdGEpXG4gICAgICAgIH07XG4gICAgICAgIGNvbnNvbGUubG9nKCdoZWFydCByYXRlJywgb2JqLmhlYXJ0UmF0ZSk7XG4gICAgICAgIGZuKG9iaik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmbih7XG4gICAgICAgICAgZXJyb3I6ICdVbmFibGUgdG8gcmVhZCB0byBoZWFydCByYXRlJ1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdWJzcmliZShtYWluQ2hhcmFjdGVyaXN0aWMpIHtcbiAgICAgIG1haW5DaGFyYWN0ZXJpc3RpYy5vbigncmVhZCcsIG9uUmVhZCk7XG5cbiAgICAgIC8vIHRydWUgdG8gZW5hYmxlIG5vdGlmeVxuICAgICAgbWFpbkNoYXJhY3RlcmlzdGljLm5vdGlmeSh0cnVlLCBmdW5jdGlvbihlcnJvcikge1xuICAgICAgICBjb25zb2xlLmxvZygnSGVhcnQgcmF0ZSBsZXZlbCBub3RpZmljYXRpb24nKTtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgZm4oe1xuICAgICAgICAgICAgZXJyb3I6ICdVbmFibGUgdG8gc3Vic2NyaWJlIHRvIGhlYXJ0IHJhdGUnXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldENoYXJhY3RlcmlzdGljcyhkZXZpY2VTZXJ2aWNlKSB7XG4gICAgICBkZXZpY2VTZXJ2aWNlLmRpc2NvdmVyQ2hhcmFjdGVyaXN0aWNzKFtjaGFyYWN0ZXJpc3RpY1V1aWRdLCBmdW5jdGlvbihlcnJvciwgY2hhcmFjdGVyaXN0aWNzKSB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdFcnJvciBkaXNjb3ZlcmluZyBjaGFyYWN0ZXJpc3RpY3MnLCBlcnJvcik7XG4gICAgICAgICAgZm4oe1xuICAgICAgICAgICAgZXJyb3I6IGVycm9yXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIG1haW5DaGFyYWN0ZXJpc3RpYyA9IGNoYXJhY3RlcmlzdGljc1swXTtcbiAgICAgICAgICBjb25zb2xlLmxvZygnRGlzY292ZXJlZCBoZWFydCByYXRlIGNoYXJhY3RlcmlzdGljIGZvciByZWFkJywgbWFpbkNoYXJhY3RlcmlzdGljLnV1aWQpO1xuICAgICAgICAgIHN1YnNyaWJlKG1haW5DaGFyYWN0ZXJpc3RpYyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFNlcnZpY2VzKCkge1xuICAgICAgcGVyaXBoZXJhbC5kaXNjb3ZlclNlcnZpY2VzKHNlcnZpY2VVdWlkcywgZnVuY3Rpb24oZXJyb3IsIHNlcnZpY2VzKSB7XG4gICAgICAgIHZhciBkZXZpY2VTZXJ2aWNlID0gc2VydmljZXNbMF07XG4gICAgICAgIGlmICghZGV2aWNlU2VydmljZSkge1xuICAgICAgICAgIHZhciBtc2cgPSAnTm8gaGVhcnQgcmF0ZSBzZXJ2aWNlIGZvdW5kJztcbiAgICAgICAgICBjb25zb2xlLmxvZygnRGlzY292ZXIgc2VydmljZXMgZXJyb3InLCBzZXJ2aWNlcyk7XG4gICAgICAgICAgcmV0dXJuIGZuKHtcbiAgICAgICAgICAgIGVycm9yOiBtc2dcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnRGlzY292ZXJlZCBoZWFydCByYXRlIHNlcnZpY2UgZm9yIHJlYWQnLCBkZXZpY2VTZXJ2aWNlLnV1aWQpO1xuICAgICAgICB9XG4gICAgICAgIGdldENoYXJhY3RlcmlzdGljcyhkZXZpY2VTZXJ2aWNlKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpc29ubmVjdCgpIHtcbiAgICAgIHBlcmlwaGVyYWwuZGlzY29ubmVjdCgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlYWR5Rm9yRGlzb25uZWN0KCkge1xuICAgICAgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigncGF1c2UnLCBkaXNvbm5lY3QpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uQ29ubmVjdCgpIHtcbiAgICAgIHJlYWR5Rm9yRGlzb25uZWN0KCk7XG4gICAgICBnZXRTZXJ2aWNlcygpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvbm5lY3QoKSB7XG4gICAgICBwZXJpcGhlcmFsLmNvbm5lY3Qob25Db25uZWN0KTtcbiAgICB9XG4gICAgY29uc29sZS5sb2coJ1BlcmlwaGVyYWwnLCBwZXJpcGhlcmFsKTtcbiAgICBpZiAocGVyaXBoZXJhbC5zdGF0ZSA9PT0gJ2Nvbm5lY3RlZCcpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdBbHJlYWR5IGNvbm5lY3RlZCB0byBwZXJpcGhlcmFsJyk7XG4gICAgICBvbkNvbm5lY3QoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ0Nvbm5lY3RpbmcgdG8gcGVyaXBoZXJhbCcpO1xuICAgICAgY29ubmVjdCgpO1xuICAgIH1cblxuICB9LCBhcGkubG9nSXQpO1xufVxuXG5saWIuaW5pdCA9IGZ1bmN0aW9uKG9wdHMsIG5ld0FwaSkge1xuICBvcHRpb25zID0gb3B0cztcbiAgYXBpID0gbmV3QXBpO1xuXG4gIHN0YXJ0TW9uaXRvcihmdW5jdGlvbihkYXRhKSB7XG4gICAgaWYgKCFkYXRhKSBkYXRhID0ge307XG4gICAgaWYgKGRhdGEuZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdFcnJvciBpbiBIZWFydGJlYXQgUGx1Z2luOiAnICsgSlNPTi5zdHJpbmdpZnkoZGF0YS5lcnJvcikpO1xuICAgICAgYXBpLmxvZ0l0KGRhdGEuZXJyb3IpO1xuICAgIH0gZWxzZSB7XG4gICAgICBhcGkubG9nSGVhcnRyYXRlKGRhdGEuaGVhcnRSYXRlKTtcbiAgICB9XG4gIH0pO1xuXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGxpYjtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiSXJYVXN1XCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvaGVhcnRyYXRlLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIklyWFVzdVwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcmVzb2x2ZS9lbXB0eS5qc1wiLFwiL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcmVzb2x2ZVwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTJcblxuLyoqXG4gKiBJZiBgQnVmZmVyLl91c2VUeXBlZEFycmF5c2A6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBVc2UgT2JqZWN0IGltcGxlbWVudGF0aW9uIChjb21wYXRpYmxlIGRvd24gdG8gSUU2KVxuICovXG5CdWZmZXIuX3VzZVR5cGVkQXJyYXlzID0gKGZ1bmN0aW9uICgpIHtcbiAgLy8gRGV0ZWN0IGlmIGJyb3dzZXIgc3VwcG9ydHMgVHlwZWQgQXJyYXlzLiBTdXBwb3J0ZWQgYnJvd3NlcnMgYXJlIElFIDEwKywgRmlyZWZveCA0KyxcbiAgLy8gQ2hyb21lIDcrLCBTYWZhcmkgNS4xKywgT3BlcmEgMTEuNissIGlPUyA0LjIrLiBJZiB0aGUgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IGFkZGluZ1xuICAvLyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMsIHRoZW4gdGhhdCdzIHRoZSBzYW1lIGFzIG5vIGBVaW50OEFycmF5YCBzdXBwb3J0XG4gIC8vIGJlY2F1c2Ugd2UgbmVlZCB0byBiZSBhYmxlIHRvIGFkZCBhbGwgdGhlIG5vZGUgQnVmZmVyIEFQSSBtZXRob2RzLiBUaGlzIGlzIGFuIGlzc3VlXG4gIC8vIGluIEZpcmVmb3ggNC0yOS4gTm93IGZpeGVkOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzhcbiAgdHJ5IHtcbiAgICB2YXIgYnVmID0gbmV3IEFycmF5QnVmZmVyKDApXG4gICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KGJ1ZilcbiAgICBhcnIuZm9vID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfVxuICAgIHJldHVybiA0MiA9PT0gYXJyLmZvbygpICYmXG4gICAgICAgIHR5cGVvZiBhcnIuc3ViYXJyYXkgPT09ICdmdW5jdGlvbicgLy8gQ2hyb21lIDktMTAgbGFjayBgc3ViYXJyYXlgXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufSkoKVxuXG4vKipcbiAqIENsYXNzOiBCdWZmZXJcbiAqID09PT09PT09PT09PT1cbiAqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGFyZSBhdWdtZW50ZWRcbiAqIHdpdGggZnVuY3Rpb24gcHJvcGVydGllcyBmb3IgYWxsIHRoZSBub2RlIGBCdWZmZXJgIEFQSSBmdW5jdGlvbnMuIFdlIHVzZVxuICogYFVpbnQ4QXJyYXlgIHNvIHRoYXQgc3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXQgcmV0dXJuc1xuICogYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogQnkgYXVnbWVudGluZyB0aGUgaW5zdGFuY2VzLCB3ZSBjYW4gYXZvaWQgbW9kaWZ5aW5nIHRoZSBgVWludDhBcnJheWBcbiAqIHByb3RvdHlwZS5cbiAqL1xuZnVuY3Rpb24gQnVmZmVyIChzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKVxuICAgIHJldHVybiBuZXcgQnVmZmVyKHN1YmplY3QsIGVuY29kaW5nLCBub1plcm8pXG5cbiAgdmFyIHR5cGUgPSB0eXBlb2Ygc3ViamVjdFxuXG4gIC8vIFdvcmthcm91bmQ6IG5vZGUncyBiYXNlNjQgaW1wbGVtZW50YXRpb24gYWxsb3dzIGZvciBub24tcGFkZGVkIHN0cmluZ3NcbiAgLy8gd2hpbGUgYmFzZTY0LWpzIGRvZXMgbm90LlxuICBpZiAoZW5jb2RpbmcgPT09ICdiYXNlNjQnICYmIHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgc3ViamVjdCA9IHN0cmluZ3RyaW0oc3ViamVjdClcbiAgICB3aGlsZSAoc3ViamVjdC5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgICBzdWJqZWN0ID0gc3ViamVjdCArICc9J1xuICAgIH1cbiAgfVxuXG4gIC8vIEZpbmQgdGhlIGxlbmd0aFxuICB2YXIgbGVuZ3RoXG4gIGlmICh0eXBlID09PSAnbnVtYmVyJylcbiAgICBsZW5ndGggPSBjb2VyY2Uoc3ViamVjdClcbiAgZWxzZSBpZiAodHlwZSA9PT0gJ3N0cmluZycpXG4gICAgbGVuZ3RoID0gQnVmZmVyLmJ5dGVMZW5ndGgoc3ViamVjdCwgZW5jb2RpbmcpXG4gIGVsc2UgaWYgKHR5cGUgPT09ICdvYmplY3QnKVxuICAgIGxlbmd0aCA9IGNvZXJjZShzdWJqZWN0Lmxlbmd0aCkgLy8gYXNzdW1lIHRoYXQgb2JqZWN0IGlzIGFycmF5LWxpa2VcbiAgZWxzZVxuICAgIHRocm93IG5ldyBFcnJvcignRmlyc3QgYXJndW1lbnQgbmVlZHMgdG8gYmUgYSBudW1iZXIsIGFycmF5IG9yIHN0cmluZy4nKVxuXG4gIHZhciBidWZcbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICAvLyBQcmVmZXJyZWQ6IFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgYnVmID0gQnVmZmVyLl9hdWdtZW50KG5ldyBVaW50OEFycmF5KGxlbmd0aCkpXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBUSElTIGluc3RhbmNlIG9mIEJ1ZmZlciAoY3JlYXRlZCBieSBgbmV3YClcbiAgICBidWYgPSB0aGlzXG4gICAgYnVmLmxlbmd0aCA9IGxlbmd0aFxuICAgIGJ1Zi5faXNCdWZmZXIgPSB0cnVlXG4gIH1cblxuICB2YXIgaVxuICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cyAmJiB0eXBlb2Ygc3ViamVjdC5ieXRlTGVuZ3RoID09PSAnbnVtYmVyJykge1xuICAgIC8vIFNwZWVkIG9wdGltaXphdGlvbiAtLSB1c2Ugc2V0IGlmIHdlJ3JlIGNvcHlpbmcgZnJvbSBhIHR5cGVkIGFycmF5XG4gICAgYnVmLl9zZXQoc3ViamVjdClcbiAgfSBlbHNlIGlmIChpc0FycmF5aXNoKHN1YmplY3QpKSB7XG4gICAgLy8gVHJlYXQgYXJyYXktaXNoIG9iamVjdHMgYXMgYSBieXRlIGFycmF5XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoQnVmZmVyLmlzQnVmZmVyKHN1YmplY3QpKVxuICAgICAgICBidWZbaV0gPSBzdWJqZWN0LnJlYWRVSW50OChpKVxuICAgICAgZWxzZVxuICAgICAgICBidWZbaV0gPSBzdWJqZWN0W2ldXG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgYnVmLndyaXRlKHN1YmplY3QsIDAsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdudW1iZXInICYmICFCdWZmZXIuX3VzZVR5cGVkQXJyYXlzICYmICFub1plcm8pIHtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGJ1ZltpXSA9IDBcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnVmXG59XG5cbi8vIFNUQVRJQyBNRVRIT0RTXG4vLyA9PT09PT09PT09PT09PVxuXG5CdWZmZXIuaXNFbmNvZGluZyA9IGZ1bmN0aW9uIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAncmF3JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gKGIpIHtcbiAgcmV0dXJuICEhKGIgIT09IG51bGwgJiYgYiAhPT0gdW5kZWZpbmVkICYmIGIuX2lzQnVmZmVyKVxufVxuXG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGZ1bmN0aW9uIChzdHIsIGVuY29kaW5nKSB7XG4gIHZhciByZXRcbiAgc3RyID0gc3RyICsgJydcbiAgc3dpdGNoIChlbmNvZGluZyB8fCAndXRmOCcpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aCAvIDJcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gdXRmOFRvQnl0ZXMoc3RyKS5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAncmF3JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IGJhc2U2NFRvQnl0ZXMoc3RyKS5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggKiAyXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZW5jb2RpbmcnKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIChsaXN0LCB0b3RhbExlbmd0aCkge1xuICBhc3NlcnQoaXNBcnJheShsaXN0KSwgJ1VzYWdlOiBCdWZmZXIuY29uY2F0KGxpc3QsIFt0b3RhbExlbmd0aF0pXFxuJyArXG4gICAgICAnbGlzdCBzaG91bGQgYmUgYW4gQXJyYXkuJylcblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcigwKVxuICB9IGVsc2UgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIGxpc3RbMF1cbiAgfVxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdG90YWxMZW5ndGggIT09ICdudW1iZXInKSB7XG4gICAgdG90YWxMZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRvdGFsTGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIodG90YWxMZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGl0ZW0gPSBsaXN0W2ldXG4gICAgaXRlbS5jb3B5KGJ1ZiwgcG9zKVxuICAgIHBvcyArPSBpdGVtLmxlbmd0aFxuICB9XG4gIHJldHVybiBidWZcbn1cblxuLy8gQlVGRkVSIElOU1RBTkNFIE1FVEhPRFNcbi8vID09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIF9oZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGFzc2VydChzdHJMZW4gJSAyID09PSAwLCAnSW52YWxpZCBoZXggc3RyaW5nJylcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGJ5dGUgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgYXNzZXJ0KCFpc05hTihieXRlKSwgJ0ludmFsaWQgaGV4IHN0cmluZycpXG4gICAgYnVmW29mZnNldCArIGldID0gYnl0ZVxuICB9XG4gIEJ1ZmZlci5fY2hhcnNXcml0dGVuID0gaSAqIDJcbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gX3V0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIF9hc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IEJ1ZmZlci5fY2hhcnNXcml0dGVuID1cbiAgICBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIF9iaW5hcnlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBfYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIF9iYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gX3V0ZjE2bGVXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gU3VwcG9ydCBib3RoIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZylcbiAgLy8gYW5kIHRoZSBsZWdhY3kgKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIGlmICghaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgfSBlbHNlIHsgIC8vIGxlZ2FjeVxuICAgIHZhciBzd2FwID0gZW5jb2RpbmdcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIG9mZnNldCA9IGxlbmd0aFxuICAgIGxlbmd0aCA9IHN3YXBcbiAgfVxuXG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cbiAgZW5jb2RpbmcgPSBTdHJpbmcoZW5jb2RpbmcgfHwgJ3V0ZjgnKS50b0xvd2VyQ2FzZSgpXG5cbiAgdmFyIHJldFxuICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IF9oZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSBfdXRmOFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIHJldCA9IF9hc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICByZXQgPSBfYmluYXJ5V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IF9iYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gX3V0ZjE2bGVXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG5cbiAgZW5jb2RpbmcgPSBTdHJpbmcoZW5jb2RpbmcgfHwgJ3V0ZjgnKS50b0xvd2VyQ2FzZSgpXG4gIHN0YXJ0ID0gTnVtYmVyKHN0YXJ0KSB8fCAwXG4gIGVuZCA9IChlbmQgIT09IHVuZGVmaW5lZClcbiAgICA/IE51bWJlcihlbmQpXG4gICAgOiBlbmQgPSBzZWxmLmxlbmd0aFxuXG4gIC8vIEZhc3RwYXRoIGVtcHR5IHN0cmluZ3NcbiAgaWYgKGVuZCA9PT0gc3RhcnQpXG4gICAgcmV0dXJuICcnXG5cbiAgdmFyIHJldFxuICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IF9oZXhTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSBfdXRmOFNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIHJldCA9IF9hc2NpaVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICByZXQgPSBfYmluYXJ5U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IF9iYXNlNjRTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gX3V0ZjE2bGVTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uICh0YXJnZXQsIHRhcmdldF9zdGFydCwgc3RhcnQsIGVuZCkge1xuICB2YXIgc291cmNlID0gdGhpc1xuXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICghdGFyZ2V0X3N0YXJ0KSB0YXJnZXRfc3RhcnQgPSAwXG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgc291cmNlLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBhc3NlcnQoZW5kID49IHN0YXJ0LCAnc291cmNlRW5kIDwgc291cmNlU3RhcnQnKVxuICBhc3NlcnQodGFyZ2V0X3N0YXJ0ID49IDAgJiYgdGFyZ2V0X3N0YXJ0IDwgdGFyZ2V0Lmxlbmd0aCxcbiAgICAgICd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgYXNzZXJ0KHN0YXJ0ID49IDAgJiYgc3RhcnQgPCBzb3VyY2UubGVuZ3RoLCAnc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChlbmQgPj0gMCAmJiBlbmQgPD0gc291cmNlLmxlbmd0aCwgJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpXG4gICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRfc3RhcnQgPCBlbmQgLSBzdGFydClcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0ICsgc3RhcnRcblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcblxuICBpZiAobGVuIDwgMTAwIHx8ICFCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0X3N0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICB9IGVsc2Uge1xuICAgIHRhcmdldC5fc2V0KHRoaXMuc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgbGVuKSwgdGFyZ2V0X3N0YXJ0KVxuICB9XG59XG5cbmZ1bmN0aW9uIF9iYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gX3V0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXMgPSAnJ1xuICB2YXIgdG1wID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgaWYgKGJ1ZltpXSA8PSAweDdGKSB7XG4gICAgICByZXMgKz0gZGVjb2RlVXRmOENoYXIodG1wKSArIFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICAgICAgdG1wID0gJydcbiAgICB9IGVsc2Uge1xuICAgICAgdG1wICs9ICclJyArIGJ1ZltpXS50b1N0cmluZygxNilcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzICsgZGVjb2RlVXRmOENoYXIodG1wKVxufVxuXG5mdW5jdGlvbiBfYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspXG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIF9iaW5hcnlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHJldHVybiBfYXNjaWlTbGljZShidWYsIHN0YXJ0LCBlbmQpXG59XG5cbmZ1bmN0aW9uIF9oZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIF91dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIGJ5dGVzW2krMV0gKiAyNTYpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gY2xhbXAoc3RhcnQsIGxlbiwgMClcbiAgZW5kID0gY2xhbXAoZW5kLCBsZW4sIGxlbilcblxuICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIHJldHVybiBCdWZmZXIuX2F1Z21lbnQodGhpcy5zdWJhcnJheShzdGFydCwgZW5kKSlcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIHZhciBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQsIHRydWUpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgaSsrKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gICAgcmV0dXJuIG5ld0J1ZlxuICB9XG59XG5cbi8vIGBnZXRgIHdpbGwgYmUgcmVtb3ZlZCBpbiBOb2RlIDAuMTMrXG5CdWZmZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5nZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLnJlYWRVSW50OChvZmZzZXQpXG59XG5cbi8vIGBzZXRgIHdpbGwgYmUgcmVtb3ZlZCBpbiBOb2RlIDAuMTMrXG5CdWZmZXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uICh2LCBvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5zZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLndyaXRlVUludDgodiwgb2Zmc2V0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50OCA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgPCB0aGlzLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpXG4gICAgcmV0dXJuXG5cbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5mdW5jdGlvbiBfcmVhZFVJbnQxNiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWxcbiAgaWYgKGxpdHRsZUVuZGlhbikge1xuICAgIHZhbCA9IGJ1ZltvZmZzZXRdXG4gICAgaWYgKG9mZnNldCArIDEgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDFdIDw8IDhcbiAgfSBlbHNlIHtcbiAgICB2YWwgPSBidWZbb2Zmc2V0XSA8PCA4XG4gICAgaWYgKG9mZnNldCArIDEgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDFdXG4gIH1cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZFVJbnQxNih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZFVJbnQxNih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRVSW50MzIgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsXG4gIGlmIChsaXR0bGVFbmRpYW4pIHtcbiAgICBpZiAob2Zmc2V0ICsgMiA8IGxlbilcbiAgICAgIHZhbCA9IGJ1ZltvZmZzZXQgKyAyXSA8PCAxNlxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXSA8PCA4XG4gICAgdmFsIHw9IGJ1ZltvZmZzZXRdXG4gICAgaWYgKG9mZnNldCArIDMgPCBsZW4pXG4gICAgICB2YWwgPSB2YWwgKyAoYnVmW29mZnNldCArIDNdIDw8IDI0ID4+PiAwKVxuICB9IGVsc2Uge1xuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsID0gYnVmW29mZnNldCArIDFdIDw8IDE2XG4gICAgaWYgKG9mZnNldCArIDIgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDJdIDw8IDhcbiAgICBpZiAob2Zmc2V0ICsgMyA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgM11cbiAgICB2YWwgPSB2YWwgKyAoYnVmW29mZnNldF0gPDwgMjQgPj4+IDApXG4gIH1cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZFVJbnQzMih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZFVJbnQzMih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLFxuICAgICAgICAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgPCB0aGlzLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpXG4gICAgcmV0dXJuXG5cbiAgdmFyIG5lZyA9IHRoaXNbb2Zmc2V0XSAmIDB4ODBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xXG4gIGVsc2VcbiAgICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbmZ1bmN0aW9uIF9yZWFkSW50MTYgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsID0gX3JlYWRVSW50MTYoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgdHJ1ZSlcbiAgdmFyIG5lZyA9IHZhbCAmIDB4ODAwMFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZmZmIC0gdmFsICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkSW50MTYodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDE2KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZEludDMyIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbCA9IF9yZWFkVUludDMyKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIHRydWUpXG4gIHZhciBuZWcgPSB2YWwgJiAweDgwMDAwMDAwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmZmZmZmZmIC0gdmFsICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkSW50MzIodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDMyKHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZEZsb2F0IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHJldHVybiBpZWVlNzU0LnJlYWQoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRGbG9hdCh0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRmxvYXQodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkRG91YmxlIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgKyA3IDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHJldHVybiBpZWVlNzU0LnJlYWQoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRG91YmxlKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRG91YmxlKHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZilcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpIHJldHVyblxuXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG59XG5cbmZ1bmN0aW9uIF93cml0ZVVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ3RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZ1aW50KHZhbHVlLCAweGZmZmYpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGxlbiAtIG9mZnNldCwgMik7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPVxuICAgICAgICAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZVVJbnQzMiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ3RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZ1aW50KHZhbHVlLCAweGZmZmZmZmZmKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihsZW4gLSBvZmZzZXQsIDQpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID1cbiAgICAgICAgKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgPCB0aGlzLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmLCAtMHg4MClcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgdGhpcy53cml0ZVVJbnQ4KHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgdGhpcy53cml0ZVVJbnQ4KDB4ZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2ZmZiwgLTB4ODAwMClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIF93cml0ZVVJbnQxNihidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG4gIGVsc2VcbiAgICBfd3JpdGVVSW50MTYoYnVmLCAweGZmZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICBfd3JpdGVVSW50MzIoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgX3dyaXRlVUludDMyKGJ1ZiwgMHhmZmZmZmZmZiArIHZhbHVlICsgMSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZJRUVFNzU0KHZhbHVlLCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgNyA8IGJ1Zi5sZW5ndGgsXG4gICAgICAgICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmSUVFRTc1NCh2YWx1ZSwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gZmlsbCh2YWx1ZSwgc3RhcnQ9MCwgZW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmZpbGwgPSBmdW5jdGlvbiAodmFsdWUsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCF2YWx1ZSkgdmFsdWUgPSAwXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCkgZW5kID0gdGhpcy5sZW5ndGhcblxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgIHZhbHVlID0gdmFsdWUuY2hhckNvZGVBdCgwKVxuICB9XG5cbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgIWlzTmFOKHZhbHVlKSwgJ3ZhbHVlIGlzIG5vdCBhIG51bWJlcicpXG4gIGFzc2VydChlbmQgPj0gc3RhcnQsICdlbmQgPCBzdGFydCcpXG5cbiAgLy8gRmlsbCAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICBhc3NlcnQoc3RhcnQgPj0gMCAmJiBzdGFydCA8IHRoaXMubGVuZ3RoLCAnc3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChlbmQgPj0gMCAmJiBlbmQgPD0gdGhpcy5sZW5ndGgsICdlbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICB0aGlzW2ldID0gdmFsdWVcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluc3BlY3QgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBvdXQgPSBbXVxuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIG91dFtpXSA9IHRvSGV4KHRoaXNbaV0pXG4gICAgaWYgKGkgPT09IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMpIHtcbiAgICAgIG91dFtpICsgMV0gPSAnLi4uJ1xuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBvdXQuam9pbignICcpICsgJz4nXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBgQXJyYXlCdWZmZXJgIHdpdGggdGhlICpjb3BpZWQqIG1lbW9yeSBvZiB0aGUgYnVmZmVyIGluc3RhbmNlLlxuICogQWRkZWQgaW4gTm9kZSAwLjEyLiBPbmx5IGF2YWlsYWJsZSBpbiBicm93c2VycyB0aGF0IHN1cHBvcnQgQXJyYXlCdWZmZXIuXG4gKi9cbkJ1ZmZlci5wcm90b3R5cGUudG9BcnJheUJ1ZmZlciA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgICByZXR1cm4gKG5ldyBCdWZmZXIodGhpcykpLmJ1ZmZlclxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgYnVmID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5sZW5ndGgpXG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYnVmLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxKVxuICAgICAgICBidWZbaV0gPSB0aGlzW2ldXG4gICAgICByZXR1cm4gYnVmLmJ1ZmZlclxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0J1ZmZlci50b0FycmF5QnVmZmVyIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBicm93c2VyJylcbiAgfVxufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIHN0cmluZ3RyaW0gKHN0cikge1xuICBpZiAoc3RyLnRyaW0pIHJldHVybiBzdHIudHJpbSgpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG59XG5cbnZhciBCUCA9IEJ1ZmZlci5wcm90b3R5cGVcblxuLyoqXG4gKiBBdWdtZW50IGEgVWludDhBcnJheSAqaW5zdGFuY2UqIChub3QgdGhlIFVpbnQ4QXJyYXkgY2xhc3MhKSB3aXRoIEJ1ZmZlciBtZXRob2RzXG4gKi9cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgYXJyLl9pc0J1ZmZlciA9IHRydWVcblxuICAvLyBzYXZlIHJlZmVyZW5jZSB0byBvcmlnaW5hbCBVaW50OEFycmF5IGdldC9zZXQgbWV0aG9kcyBiZWZvcmUgb3ZlcndyaXRpbmdcbiAgYXJyLl9nZXQgPSBhcnIuZ2V0XG4gIGFyci5fc2V0ID0gYXJyLnNldFxuXG4gIC8vIGRlcHJlY2F0ZWQsIHdpbGwgYmUgcmVtb3ZlZCBpbiBub2RlIDAuMTMrXG4gIGFyci5nZXQgPSBCUC5nZXRcbiAgYXJyLnNldCA9IEJQLnNldFxuXG4gIGFyci53cml0ZSA9IEJQLndyaXRlXG4gIGFyci50b1N0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0xvY2FsZVN0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0pTT04gPSBCUC50b0pTT05cbiAgYXJyLmNvcHkgPSBCUC5jb3B5XG4gIGFyci5zbGljZSA9IEJQLnNsaWNlXG4gIGFyci5yZWFkVUludDggPSBCUC5yZWFkVUludDhcbiAgYXJyLnJlYWRVSW50MTZMRSA9IEJQLnJlYWRVSW50MTZMRVxuICBhcnIucmVhZFVJbnQxNkJFID0gQlAucmVhZFVJbnQxNkJFXG4gIGFyci5yZWFkVUludDMyTEUgPSBCUC5yZWFkVUludDMyTEVcbiAgYXJyLnJlYWRVSW50MzJCRSA9IEJQLnJlYWRVSW50MzJCRVxuICBhcnIucmVhZEludDggPSBCUC5yZWFkSW50OFxuICBhcnIucmVhZEludDE2TEUgPSBCUC5yZWFkSW50MTZMRVxuICBhcnIucmVhZEludDE2QkUgPSBCUC5yZWFkSW50MTZCRVxuICBhcnIucmVhZEludDMyTEUgPSBCUC5yZWFkSW50MzJMRVxuICBhcnIucmVhZEludDMyQkUgPSBCUC5yZWFkSW50MzJCRVxuICBhcnIucmVhZEZsb2F0TEUgPSBCUC5yZWFkRmxvYXRMRVxuICBhcnIucmVhZEZsb2F0QkUgPSBCUC5yZWFkRmxvYXRCRVxuICBhcnIucmVhZERvdWJsZUxFID0gQlAucmVhZERvdWJsZUxFXG4gIGFyci5yZWFkRG91YmxlQkUgPSBCUC5yZWFkRG91YmxlQkVcbiAgYXJyLndyaXRlVUludDggPSBCUC53cml0ZVVJbnQ4XG4gIGFyci53cml0ZVVJbnQxNkxFID0gQlAud3JpdGVVSW50MTZMRVxuICBhcnIud3JpdGVVSW50MTZCRSA9IEJQLndyaXRlVUludDE2QkVcbiAgYXJyLndyaXRlVUludDMyTEUgPSBCUC53cml0ZVVJbnQzMkxFXG4gIGFyci53cml0ZVVJbnQzMkJFID0gQlAud3JpdGVVSW50MzJCRVxuICBhcnIud3JpdGVJbnQ4ID0gQlAud3JpdGVJbnQ4XG4gIGFyci53cml0ZUludDE2TEUgPSBCUC53cml0ZUludDE2TEVcbiAgYXJyLndyaXRlSW50MTZCRSA9IEJQLndyaXRlSW50MTZCRVxuICBhcnIud3JpdGVJbnQzMkxFID0gQlAud3JpdGVJbnQzMkxFXG4gIGFyci53cml0ZUludDMyQkUgPSBCUC53cml0ZUludDMyQkVcbiAgYXJyLndyaXRlRmxvYXRMRSA9IEJQLndyaXRlRmxvYXRMRVxuICBhcnIud3JpdGVGbG9hdEJFID0gQlAud3JpdGVGbG9hdEJFXG4gIGFyci53cml0ZURvdWJsZUxFID0gQlAud3JpdGVEb3VibGVMRVxuICBhcnIud3JpdGVEb3VibGVCRSA9IEJQLndyaXRlRG91YmxlQkVcbiAgYXJyLmZpbGwgPSBCUC5maWxsXG4gIGFyci5pbnNwZWN0ID0gQlAuaW5zcGVjdFxuICBhcnIudG9BcnJheUJ1ZmZlciA9IEJQLnRvQXJyYXlCdWZmZXJcblxuICByZXR1cm4gYXJyXG59XG5cbi8vIHNsaWNlKHN0YXJ0LCBlbmQpXG5mdW5jdGlvbiBjbGFtcCAoaW5kZXgsIGxlbiwgZGVmYXVsdFZhbHVlKSB7XG4gIGlmICh0eXBlb2YgaW5kZXggIT09ICdudW1iZXInKSByZXR1cm4gZGVmYXVsdFZhbHVlXG4gIGluZGV4ID0gfn5pbmRleDsgIC8vIENvZXJjZSB0byBpbnRlZ2VyLlxuICBpZiAoaW5kZXggPj0gbGVuKSByZXR1cm4gbGVuXG4gIGlmIChpbmRleCA+PSAwKSByZXR1cm4gaW5kZXhcbiAgaW5kZXggKz0gbGVuXG4gIGlmIChpbmRleCA+PSAwKSByZXR1cm4gaW5kZXhcbiAgcmV0dXJuIDBcbn1cblxuZnVuY3Rpb24gY29lcmNlIChsZW5ndGgpIHtcbiAgLy8gQ29lcmNlIGxlbmd0aCB0byBhIG51bWJlciAocG9zc2libHkgTmFOKSwgcm91bmQgdXBcbiAgLy8gaW4gY2FzZSBpdCdzIGZyYWN0aW9uYWwgKGUuZy4gMTIzLjQ1NikgdGhlbiBkbyBhXG4gIC8vIGRvdWJsZSBuZWdhdGUgdG8gY29lcmNlIGEgTmFOIHRvIDAuIEVhc3ksIHJpZ2h0P1xuICBsZW5ndGggPSB+fk1hdGguY2VpbCgrbGVuZ3RoKVxuICByZXR1cm4gbGVuZ3RoIDwgMCA/IDAgOiBsZW5ndGhcbn1cblxuZnVuY3Rpb24gaXNBcnJheSAoc3ViamVjdCkge1xuICByZXR1cm4gKEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHN1YmplY3QpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHN1YmplY3QpID09PSAnW29iamVjdCBBcnJheV0nXG4gIH0pKHN1YmplY3QpXG59XG5cbmZ1bmN0aW9uIGlzQXJyYXlpc2ggKHN1YmplY3QpIHtcbiAgcmV0dXJuIGlzQXJyYXkoc3ViamVjdCkgfHwgQnVmZmVyLmlzQnVmZmVyKHN1YmplY3QpIHx8XG4gICAgICBzdWJqZWN0ICYmIHR5cGVvZiBzdWJqZWN0ID09PSAnb2JqZWN0JyAmJlxuICAgICAgdHlwZW9mIHN1YmplY3QubGVuZ3RoID09PSAnbnVtYmVyJ1xufVxuXG5mdW5jdGlvbiB0b0hleCAobikge1xuICBpZiAobiA8IDE2KSByZXR1cm4gJzAnICsgbi50b1N0cmluZygxNilcbiAgcmV0dXJuIG4udG9TdHJpbmcoMTYpXG59XG5cbmZ1bmN0aW9uIHV0ZjhUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGIgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGlmIChiIDw9IDB4N0YpXG4gICAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSlcbiAgICBlbHNlIHtcbiAgICAgIHZhciBzdGFydCA9IGlcbiAgICAgIGlmIChiID49IDB4RDgwMCAmJiBiIDw9IDB4REZGRikgaSsrXG4gICAgICB2YXIgaCA9IGVuY29kZVVSSUNvbXBvbmVudChzdHIuc2xpY2Uoc3RhcnQsIGkrMSkpLnN1YnN0cigxKS5zcGxpdCgnJScpXG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGgubGVuZ3RoOyBqKyspXG4gICAgICAgIGJ5dGVBcnJheS5wdXNoKHBhcnNlSW50KGhbal0sIDE2KSlcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoc3RyKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIHBvc1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKVxuICAgICAgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiBkZWNvZGVVdGY4Q2hhciAoc3RyKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChzdHIpXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4RkZGRCkgLy8gVVRGIDggaW52YWxpZCBjaGFyXG4gIH1cbn1cblxuLypcbiAqIFdlIGhhdmUgdG8gbWFrZSBzdXJlIHRoYXQgdGhlIHZhbHVlIGlzIGEgdmFsaWQgaW50ZWdlci4gVGhpcyBtZWFucyB0aGF0IGl0XG4gKiBpcyBub24tbmVnYXRpdmUuIEl0IGhhcyBubyBmcmFjdGlvbmFsIGNvbXBvbmVudCBhbmQgdGhhdCBpdCBkb2VzIG5vdFxuICogZXhjZWVkIHRoZSBtYXhpbXVtIGFsbG93ZWQgdmFsdWUuXG4gKi9cbmZ1bmN0aW9uIHZlcmlmdWludCAodmFsdWUsIG1heCkge1xuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJywgJ2Nhbm5vdCB3cml0ZSBhIG5vbi1udW1iZXIgYXMgYSBudW1iZXInKVxuICBhc3NlcnQodmFsdWUgPj0gMCwgJ3NwZWNpZmllZCBhIG5lZ2F0aXZlIHZhbHVlIGZvciB3cml0aW5nIGFuIHVuc2lnbmVkIHZhbHVlJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGlzIGxhcmdlciB0aGFuIG1heGltdW0gdmFsdWUgZm9yIHR5cGUnKVxuICBhc3NlcnQoTWF0aC5mbG9vcih2YWx1ZSkgPT09IHZhbHVlLCAndmFsdWUgaGFzIGEgZnJhY3Rpb25hbCBjb21wb25lbnQnKVxufVxuXG5mdW5jdGlvbiB2ZXJpZnNpbnQgKHZhbHVlLCBtYXgsIG1pbikge1xuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJywgJ2Nhbm5vdCB3cml0ZSBhIG5vbi1udW1iZXIgYXMgYSBudW1iZXInKVxuICBhc3NlcnQodmFsdWUgPD0gbWF4LCAndmFsdWUgbGFyZ2VyIHRoYW4gbWF4aW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KHZhbHVlID49IG1pbiwgJ3ZhbHVlIHNtYWxsZXIgdGhhbiBtaW5pbXVtIGFsbG93ZWQgdmFsdWUnKVxuICBhc3NlcnQoTWF0aC5mbG9vcih2YWx1ZSkgPT09IHZhbHVlLCAndmFsdWUgaGFzIGEgZnJhY3Rpb25hbCBjb21wb25lbnQnKVxufVxuXG5mdW5jdGlvbiB2ZXJpZklFRUU3NTQgKHZhbHVlLCBtYXgsIG1pbikge1xuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJywgJ2Nhbm5vdCB3cml0ZSBhIG5vbi1udW1iZXIgYXMgYSBudW1iZXInKVxuICBhc3NlcnQodmFsdWUgPD0gbWF4LCAndmFsdWUgbGFyZ2VyIHRoYW4gbWF4aW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KHZhbHVlID49IG1pbiwgJ3ZhbHVlIHNtYWxsZXIgdGhhbiBtaW5pbXVtIGFsbG93ZWQgdmFsdWUnKVxufVxuXG5mdW5jdGlvbiBhc3NlcnQgKHRlc3QsIG1lc3NhZ2UpIHtcbiAgaWYgKCF0ZXN0KSB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSB8fCAnRmFpbGVkIGFzc2VydGlvbicpXG59XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiSXJYVXN1XCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzXCIsXCIvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIGxvb2t1cCA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJztcblxuOyhmdW5jdGlvbiAoZXhwb3J0cykge1xuXHQndXNlIHN0cmljdCc7XG5cbiAgdmFyIEFyciA9ICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgPyBVaW50OEFycmF5XG4gICAgOiBBcnJheVxuXG5cdHZhciBQTFVTICAgPSAnKycuY2hhckNvZGVBdCgwKVxuXHR2YXIgU0xBU0ggID0gJy8nLmNoYXJDb2RlQXQoMClcblx0dmFyIE5VTUJFUiA9ICcwJy5jaGFyQ29kZUF0KDApXG5cdHZhciBMT1dFUiAgPSAnYScuY2hhckNvZGVBdCgwKVxuXHR2YXIgVVBQRVIgID0gJ0EnLmNoYXJDb2RlQXQoMClcblxuXHRmdW5jdGlvbiBkZWNvZGUgKGVsdCkge1xuXHRcdHZhciBjb2RlID0gZWx0LmNoYXJDb2RlQXQoMClcblx0XHRpZiAoY29kZSA9PT0gUExVUylcblx0XHRcdHJldHVybiA2MiAvLyAnKydcblx0XHRpZiAoY29kZSA9PT0gU0xBU0gpXG5cdFx0XHRyZXR1cm4gNjMgLy8gJy8nXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIpXG5cdFx0XHRyZXR1cm4gLTEgLy9ubyBtYXRjaFxuXHRcdGlmIChjb2RlIDwgTlVNQkVSICsgMTApXG5cdFx0XHRyZXR1cm4gY29kZSAtIE5VTUJFUiArIDI2ICsgMjZcblx0XHRpZiAoY29kZSA8IFVQUEVSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIFVQUEVSXG5cdFx0aWYgKGNvZGUgPCBMT1dFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBMT1dFUiArIDI2XG5cdH1cblxuXHRmdW5jdGlvbiBiNjRUb0J5dGVBcnJheSAoYjY0KSB7XG5cdFx0dmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcblxuXHRcdGlmIChiNjQubGVuZ3RoICUgNCA+IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG5cdFx0fVxuXG5cdFx0Ly8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcblx0XHQvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG5cdFx0Ly8gcmVwcmVzZW50IG9uZSBieXRlXG5cdFx0Ly8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG5cdFx0Ly8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuXHRcdHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cdFx0cGxhY2VIb2xkZXJzID0gJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDIpID8gMiA6ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAxKSA/IDEgOiAwXG5cblx0XHQvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcblx0XHRhcnIgPSBuZXcgQXJyKGI2NC5sZW5ndGggKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuXHRcdC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcblx0XHRsID0gcGxhY2VIb2xkZXJzID4gMCA/IGI2NC5sZW5ndGggLSA0IDogYjY0Lmxlbmd0aFxuXG5cdFx0dmFyIEwgPSAwXG5cblx0XHRmdW5jdGlvbiBwdXNoICh2KSB7XG5cdFx0XHRhcnJbTCsrXSA9IHZcblx0XHR9XG5cblx0XHRmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDE4KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDEyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpIDw8IDYpIHwgZGVjb2RlKGI2NC5jaGFyQXQoaSArIDMpKVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwMDApID4+IDE2KVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwKSA+PiA4KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA+PiA0KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDEwKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDQpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPj4gMilcblx0XHRcdHB1c2goKHRtcCA+PiA4KSAmIDB4RkYpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFyclxuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCAodWludDgpIHtcblx0XHR2YXIgaSxcblx0XHRcdGV4dHJhQnl0ZXMgPSB1aW50OC5sZW5ndGggJSAzLCAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuXHRcdFx0b3V0cHV0ID0gXCJcIixcblx0XHRcdHRlbXAsIGxlbmd0aFxuXG5cdFx0ZnVuY3Rpb24gZW5jb2RlIChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXAuY2hhckF0KG51bSlcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuXHRcdFx0cmV0dXJuIGVuY29kZShudW0gPj4gMTggJiAweDNGKSArIGVuY29kZShudW0gPj4gMTIgJiAweDNGKSArIGVuY29kZShudW0gPj4gNiAmIDB4M0YpICsgZW5jb2RlKG51bSAmIDB4M0YpXG5cdFx0fVxuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcblx0XHRcdG91dHB1dCArPSB0cmlwbGV0VG9CYXNlNjQodGVtcClcblx0XHR9XG5cblx0XHQvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG5cdFx0c3dpdGNoIChleHRyYUJ5dGVzKSB7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdHRlbXAgPSB1aW50OFt1aW50OC5sZW5ndGggLSAxXVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPT0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdHRlbXAgPSAodWludDhbdWludDgubGVuZ3RoIC0gMl0gPDwgOCkgKyAodWludDhbdWludDgubGVuZ3RoIC0gMV0pXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAxMClcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA+PiA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgMikgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dHB1dFxuXHR9XG5cblx0ZXhwb3J0cy50b0J5dGVBcnJheSA9IGI2NFRvQnl0ZUFycmF5XG5cdGV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IHVpbnQ4VG9CYXNlNjRcbn0odHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gKHRoaXMuYmFzZTY0anMgPSB7fSkgOiBleHBvcnRzKSlcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJJclhVc3VcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWIvYjY0LmpzXCIsXCIvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24oYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSxcbiAgICAgIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDEsXG4gICAgICBlTWF4ID0gKDEgPDwgZUxlbikgLSAxLFxuICAgICAgZUJpYXMgPSBlTWF4ID4+IDEsXG4gICAgICBuQml0cyA9IC03LFxuICAgICAgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwLFxuICAgICAgZCA9IGlzTEUgPyAtMSA6IDEsXG4gICAgICBzID0gYnVmZmVyW29mZnNldCArIGldO1xuXG4gIGkgKz0gZDtcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKTtcbiAgcyA+Pj0gKC1uQml0cyk7XG4gIG5CaXRzICs9IGVMZW47XG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpO1xuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpO1xuICBlID4+PSAoLW5CaXRzKTtcbiAgbkJpdHMgKz0gbUxlbjtcbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCk7XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzO1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSk7XG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICBlID0gZSAtIGVCaWFzO1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pO1xufTtcblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjLFxuICAgICAgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMSxcbiAgICAgIGVNYXggPSAoMSA8PCBlTGVuKSAtIDEsXG4gICAgICBlQmlhcyA9IGVNYXggPj4gMSxcbiAgICAgIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKSxcbiAgICAgIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKSxcbiAgICAgIGQgPSBpc0xFID8gMSA6IC0xLFxuICAgICAgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMDtcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKTtcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMDtcbiAgICBlID0gZU1heDtcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMik7XG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tO1xuICAgICAgYyAqPSAyO1xuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gYztcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpO1xuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrKztcbiAgICAgIGMgLz0gMjtcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwO1xuICAgICAgZSA9IGVNYXg7XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pO1xuICAgICAgZSA9IGUgKyBlQmlhcztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pO1xuICAgICAgZSA9IDA7XG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCk7XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbTtcbiAgZUxlbiArPSBtTGVuO1xuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpO1xuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyODtcbn07XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiSXJYVXN1XCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzXCIsXCIvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0XCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIklyWFVzdVwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanNcIixcIi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHNcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5pZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgPT09ICdmdW5jdGlvbicpIHtcbiAgLy8gaW1wbGVtZW50YXRpb24gZnJvbSBzdGFuZGFyZCBub2RlLmpzICd1dGlsJyBtb2R1bGVcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIGN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckN0b3IucHJvdG90eXBlLCB7XG4gICAgICBjb25zdHJ1Y3Rvcjoge1xuICAgICAgICB2YWx1ZTogY3RvcixcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcbn0gZWxzZSB7XG4gIC8vIG9sZCBzY2hvb2wgc2hpbSBmb3Igb2xkIGJyb3dzZXJzXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICB2YXIgVGVtcEN0b3IgPSBmdW5jdGlvbiAoKSB7fVxuICAgIFRlbXBDdG9yLnByb3RvdHlwZSA9IHN1cGVyQ3Rvci5wcm90b3R5cGVcbiAgICBjdG9yLnByb3RvdHlwZSA9IG5ldyBUZW1wQ3RvcigpXG4gICAgY3Rvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBjdG9yXG4gIH1cbn1cblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJJclhVc3VcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbmhlcml0cy9pbmhlcml0c19icm93c2VyLmpzXCIsXCIvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvaW5oZXJpdHNcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5leHBvcnRzLmVuZGlhbm5lc3MgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnTEUnIH07XG5cbmV4cG9ydHMuaG9zdG5hbWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHR5cGVvZiBsb2NhdGlvbiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIGxvY2F0aW9uLmhvc3RuYW1lXG4gICAgfVxuICAgIGVsc2UgcmV0dXJuICcnO1xufTtcblxuZXhwb3J0cy5sb2FkYXZnID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gW10gfTtcblxuZXhwb3J0cy51cHRpbWUgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAwIH07XG5cbmV4cG9ydHMuZnJlZW1lbSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gTnVtYmVyLk1BWF9WQUxVRTtcbn07XG5cbmV4cG9ydHMudG90YWxtZW0gPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIE51bWJlci5NQVhfVkFMVUU7XG59O1xuXG5leHBvcnRzLmNwdXMgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBbXSB9O1xuXG5leHBvcnRzLnR5cGUgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnQnJvd3NlcicgfTtcblxuZXhwb3J0cy5yZWxlYXNlID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm4gbmF2aWdhdG9yLmFwcFZlcnNpb247XG4gICAgfVxuICAgIHJldHVybiAnJztcbn07XG5cbmV4cG9ydHMubmV0d29ya0ludGVyZmFjZXNcbj0gZXhwb3J0cy5nZXROZXR3b3JrSW50ZXJmYWNlc1xuPSBmdW5jdGlvbiAoKSB7IHJldHVybiB7fSB9O1xuXG5leHBvcnRzLmFyY2ggPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnamF2YXNjcmlwdCcgfTtcblxuZXhwb3J0cy5wbGF0Zm9ybSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICdicm93c2VyJyB9O1xuXG5leHBvcnRzLnRtcGRpciA9IGV4cG9ydHMudG1wRGlyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAnL3RtcCc7XG59O1xuXG5leHBvcnRzLkVPTCA9ICdcXG4nO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIklyWFVzdVwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL29zLWJyb3dzZXJpZnkvYnJvd3Nlci5qc1wiLFwiL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL29zLWJyb3dzZXJpZnlcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG5wcm9jZXNzLm5leHRUaWNrID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY2FuU2V0SW1tZWRpYXRlID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cuc2V0SW1tZWRpYXRlO1xuICAgIHZhciBjYW5Qb3N0ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cucG9zdE1lc3NhZ2UgJiYgd2luZG93LmFkZEV2ZW50TGlzdGVuZXJcbiAgICA7XG5cbiAgICBpZiAoY2FuU2V0SW1tZWRpYXRlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZikgeyByZXR1cm4gd2luZG93LnNldEltbWVkaWF0ZShmKSB9O1xuICAgIH1cblxuICAgIGlmIChjYW5Qb3N0KSB7XG4gICAgICAgIHZhciBxdWV1ZSA9IFtdO1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgICAgICAgICAgdmFyIHNvdXJjZSA9IGV2LnNvdXJjZTtcbiAgICAgICAgICAgIGlmICgoc291cmNlID09PSB3aW5kb3cgfHwgc291cmNlID09PSBudWxsKSAmJiBldi5kYXRhID09PSAncHJvY2Vzcy10aWNrJykge1xuICAgICAgICAgICAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGlmIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbiA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIHF1ZXVlLnB1c2goZm4pO1xuICAgICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKCdwcm9jZXNzLXRpY2snLCAnKicpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICBzZXRUaW1lb3V0KGZuLCAwKTtcbiAgICB9O1xufSkoKTtcblxucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59XG5cbi8vIFRPRE8oc2h0eWxtYW4pXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJJclhVc3VcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanNcIixcIi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc0J1ZmZlcihhcmcpIHtcbiAgcmV0dXJuIGFyZyAmJiB0eXBlb2YgYXJnID09PSAnb2JqZWN0J1xuICAgICYmIHR5cGVvZiBhcmcuY29weSA9PT0gJ2Z1bmN0aW9uJ1xuICAgICYmIHR5cGVvZiBhcmcuZmlsbCA9PT0gJ2Z1bmN0aW9uJ1xuICAgICYmIHR5cGVvZiBhcmcucmVhZFVJbnQ4ID09PSAnZnVuY3Rpb24nO1xufVxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJJclhVc3VcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy91dGlsL3N1cHBvcnQvaXNCdWZmZXJCcm93c2VyLmpzXCIsXCIvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvdXRpbC9zdXBwb3J0XCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbnZhciBmb3JtYXRSZWdFeHAgPSAvJVtzZGolXS9nO1xuZXhwb3J0cy5mb3JtYXQgPSBmdW5jdGlvbihmKSB7XG4gIGlmICghaXNTdHJpbmcoZikpIHtcbiAgICB2YXIgb2JqZWN0cyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBvYmplY3RzLnB1c2goaW5zcGVjdChhcmd1bWVudHNbaV0pKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdHMuam9pbignICcpO1xuICB9XG5cbiAgdmFyIGkgPSAxO1xuICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgdmFyIGxlbiA9IGFyZ3MubGVuZ3RoO1xuICB2YXIgc3RyID0gU3RyaW5nKGYpLnJlcGxhY2UoZm9ybWF0UmVnRXhwLCBmdW5jdGlvbih4KSB7XG4gICAgaWYgKHggPT09ICclJScpIHJldHVybiAnJSc7XG4gICAgaWYgKGkgPj0gbGVuKSByZXR1cm4geDtcbiAgICBzd2l0Y2ggKHgpIHtcbiAgICAgIGNhc2UgJyVzJzogcmV0dXJuIFN0cmluZyhhcmdzW2krK10pO1xuICAgICAgY2FzZSAnJWQnOiByZXR1cm4gTnVtYmVyKGFyZ3NbaSsrXSk7XG4gICAgICBjYXNlICclaic6XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGFyZ3NbaSsrXSk7XG4gICAgICAgIH0gY2F0Y2ggKF8pIHtcbiAgICAgICAgICByZXR1cm4gJ1tDaXJjdWxhcl0nO1xuICAgICAgICB9XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4geDtcbiAgICB9XG4gIH0pO1xuICBmb3IgKHZhciB4ID0gYXJnc1tpXTsgaSA8IGxlbjsgeCA9IGFyZ3NbKytpXSkge1xuICAgIGlmIChpc051bGwoeCkgfHwgIWlzT2JqZWN0KHgpKSB7XG4gICAgICBzdHIgKz0gJyAnICsgeDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyICs9ICcgJyArIGluc3BlY3QoeCk7XG4gICAgfVxuICB9XG4gIHJldHVybiBzdHI7XG59O1xuXG5cbi8vIE1hcmsgdGhhdCBhIG1ldGhvZCBzaG91bGQgbm90IGJlIHVzZWQuXG4vLyBSZXR1cm5zIGEgbW9kaWZpZWQgZnVuY3Rpb24gd2hpY2ggd2FybnMgb25jZSBieSBkZWZhdWx0LlxuLy8gSWYgLS1uby1kZXByZWNhdGlvbiBpcyBzZXQsIHRoZW4gaXQgaXMgYSBuby1vcC5cbmV4cG9ydHMuZGVwcmVjYXRlID0gZnVuY3Rpb24oZm4sIG1zZykge1xuICAvLyBBbGxvdyBmb3IgZGVwcmVjYXRpbmcgdGhpbmdzIGluIHRoZSBwcm9jZXNzIG9mIHN0YXJ0aW5nIHVwLlxuICBpZiAoaXNVbmRlZmluZWQoZ2xvYmFsLnByb2Nlc3MpKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGV4cG9ydHMuZGVwcmVjYXRlKGZuLCBtc2cpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgfVxuXG4gIGlmIChwcm9jZXNzLm5vRGVwcmVjYXRpb24gPT09IHRydWUpIHtcbiAgICByZXR1cm4gZm47XG4gIH1cblxuICB2YXIgd2FybmVkID0gZmFsc2U7XG4gIGZ1bmN0aW9uIGRlcHJlY2F0ZWQoKSB7XG4gICAgaWYgKCF3YXJuZWQpIHtcbiAgICAgIGlmIChwcm9jZXNzLnRocm93RGVwcmVjYXRpb24pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZyk7XG4gICAgICB9IGVsc2UgaWYgKHByb2Nlc3MudHJhY2VEZXByZWNhdGlvbikge1xuICAgICAgICBjb25zb2xlLnRyYWNlKG1zZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKG1zZyk7XG4gICAgICB9XG4gICAgICB3YXJuZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfVxuXG4gIHJldHVybiBkZXByZWNhdGVkO1xufTtcblxuXG52YXIgZGVidWdzID0ge307XG52YXIgZGVidWdFbnZpcm9uO1xuZXhwb3J0cy5kZWJ1Z2xvZyA9IGZ1bmN0aW9uKHNldCkge1xuICBpZiAoaXNVbmRlZmluZWQoZGVidWdFbnZpcm9uKSlcbiAgICBkZWJ1Z0Vudmlyb24gPSBwcm9jZXNzLmVudi5OT0RFX0RFQlVHIHx8ICcnO1xuICBzZXQgPSBzZXQudG9VcHBlckNhc2UoKTtcbiAgaWYgKCFkZWJ1Z3Nbc2V0XSkge1xuICAgIGlmIChuZXcgUmVnRXhwKCdcXFxcYicgKyBzZXQgKyAnXFxcXGInLCAnaScpLnRlc3QoZGVidWdFbnZpcm9uKSkge1xuICAgICAgdmFyIHBpZCA9IHByb2Nlc3MucGlkO1xuICAgICAgZGVidWdzW3NldF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG1zZyA9IGV4cG9ydHMuZm9ybWF0LmFwcGx5KGV4cG9ydHMsIGFyZ3VtZW50cyk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJyVzICVkOiAlcycsIHNldCwgcGlkLCBtc2cpO1xuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVidWdzW3NldF0gPSBmdW5jdGlvbigpIHt9O1xuICAgIH1cbiAgfVxuICByZXR1cm4gZGVidWdzW3NldF07XG59O1xuXG5cbi8qKlxuICogRWNob3MgdGhlIHZhbHVlIG9mIGEgdmFsdWUuIFRyeXMgdG8gcHJpbnQgdGhlIHZhbHVlIG91dFxuICogaW4gdGhlIGJlc3Qgd2F5IHBvc3NpYmxlIGdpdmVuIHRoZSBkaWZmZXJlbnQgdHlwZXMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iaiBUaGUgb2JqZWN0IHRvIHByaW50IG91dC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0IHRoYXQgYWx0ZXJzIHRoZSBvdXRwdXQuXG4gKi9cbi8qIGxlZ2FjeTogb2JqLCBzaG93SGlkZGVuLCBkZXB0aCwgY29sb3JzKi9cbmZ1bmN0aW9uIGluc3BlY3Qob2JqLCBvcHRzKSB7XG4gIC8vIGRlZmF1bHQgb3B0aW9uc1xuICB2YXIgY3R4ID0ge1xuICAgIHNlZW46IFtdLFxuICAgIHN0eWxpemU6IHN0eWxpemVOb0NvbG9yXG4gIH07XG4gIC8vIGxlZ2FjeS4uLlxuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSAzKSBjdHguZGVwdGggPSBhcmd1bWVudHNbMl07XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID49IDQpIGN0eC5jb2xvcnMgPSBhcmd1bWVudHNbM107XG4gIGlmIChpc0Jvb2xlYW4ob3B0cykpIHtcbiAgICAvLyBsZWdhY3kuLi5cbiAgICBjdHguc2hvd0hpZGRlbiA9IG9wdHM7XG4gIH0gZWxzZSBpZiAob3B0cykge1xuICAgIC8vIGdvdCBhbiBcIm9wdGlvbnNcIiBvYmplY3RcbiAgICBleHBvcnRzLl9leHRlbmQoY3R4LCBvcHRzKTtcbiAgfVxuICAvLyBzZXQgZGVmYXVsdCBvcHRpb25zXG4gIGlmIChpc1VuZGVmaW5lZChjdHguc2hvd0hpZGRlbikpIGN0eC5zaG93SGlkZGVuID0gZmFsc2U7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguZGVwdGgpKSBjdHguZGVwdGggPSAyO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmNvbG9ycykpIGN0eC5jb2xvcnMgPSBmYWxzZTtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5jdXN0b21JbnNwZWN0KSkgY3R4LmN1c3RvbUluc3BlY3QgPSB0cnVlO1xuICBpZiAoY3R4LmNvbG9ycykgY3R4LnN0eWxpemUgPSBzdHlsaXplV2l0aENvbG9yO1xuICByZXR1cm4gZm9ybWF0VmFsdWUoY3R4LCBvYmosIGN0eC5kZXB0aCk7XG59XG5leHBvcnRzLmluc3BlY3QgPSBpbnNwZWN0O1xuXG5cbi8vIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQU5TSV9lc2NhcGVfY29kZSNncmFwaGljc1xuaW5zcGVjdC5jb2xvcnMgPSB7XG4gICdib2xkJyA6IFsxLCAyMl0sXG4gICdpdGFsaWMnIDogWzMsIDIzXSxcbiAgJ3VuZGVybGluZScgOiBbNCwgMjRdLFxuICAnaW52ZXJzZScgOiBbNywgMjddLFxuICAnd2hpdGUnIDogWzM3LCAzOV0sXG4gICdncmV5JyA6IFs5MCwgMzldLFxuICAnYmxhY2snIDogWzMwLCAzOV0sXG4gICdibHVlJyA6IFszNCwgMzldLFxuICAnY3lhbicgOiBbMzYsIDM5XSxcbiAgJ2dyZWVuJyA6IFszMiwgMzldLFxuICAnbWFnZW50YScgOiBbMzUsIDM5XSxcbiAgJ3JlZCcgOiBbMzEsIDM5XSxcbiAgJ3llbGxvdycgOiBbMzMsIDM5XVxufTtcblxuLy8gRG9uJ3QgdXNlICdibHVlJyBub3QgdmlzaWJsZSBvbiBjbWQuZXhlXG5pbnNwZWN0LnN0eWxlcyA9IHtcbiAgJ3NwZWNpYWwnOiAnY3lhbicsXG4gICdudW1iZXInOiAneWVsbG93JyxcbiAgJ2Jvb2xlYW4nOiAneWVsbG93JyxcbiAgJ3VuZGVmaW5lZCc6ICdncmV5JyxcbiAgJ251bGwnOiAnYm9sZCcsXG4gICdzdHJpbmcnOiAnZ3JlZW4nLFxuICAnZGF0ZSc6ICdtYWdlbnRhJyxcbiAgLy8gXCJuYW1lXCI6IGludGVudGlvbmFsbHkgbm90IHN0eWxpbmdcbiAgJ3JlZ2V4cCc6ICdyZWQnXG59O1xuXG5cbmZ1bmN0aW9uIHN0eWxpemVXaXRoQ29sb3Ioc3RyLCBzdHlsZVR5cGUpIHtcbiAgdmFyIHN0eWxlID0gaW5zcGVjdC5zdHlsZXNbc3R5bGVUeXBlXTtcblxuICBpZiAoc3R5bGUpIHtcbiAgICByZXR1cm4gJ1xcdTAwMWJbJyArIGluc3BlY3QuY29sb3JzW3N0eWxlXVswXSArICdtJyArIHN0ciArXG4gICAgICAgICAgICdcXHUwMDFiWycgKyBpbnNwZWN0LmNvbG9yc1tzdHlsZV1bMV0gKyAnbSc7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxufVxuXG5cbmZ1bmN0aW9uIHN0eWxpemVOb0NvbG9yKHN0ciwgc3R5bGVUeXBlKSB7XG4gIHJldHVybiBzdHI7XG59XG5cblxuZnVuY3Rpb24gYXJyYXlUb0hhc2goYXJyYXkpIHtcbiAgdmFyIGhhc2ggPSB7fTtcblxuICBhcnJheS5mb3JFYWNoKGZ1bmN0aW9uKHZhbCwgaWR4KSB7XG4gICAgaGFzaFt2YWxdID0gdHJ1ZTtcbiAgfSk7XG5cbiAgcmV0dXJuIGhhc2g7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0VmFsdWUoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzKSB7XG4gIC8vIFByb3ZpZGUgYSBob29rIGZvciB1c2VyLXNwZWNpZmllZCBpbnNwZWN0IGZ1bmN0aW9ucy5cbiAgLy8gQ2hlY2sgdGhhdCB2YWx1ZSBpcyBhbiBvYmplY3Qgd2l0aCBhbiBpbnNwZWN0IGZ1bmN0aW9uIG9uIGl0XG4gIGlmIChjdHguY3VzdG9tSW5zcGVjdCAmJlxuICAgICAgdmFsdWUgJiZcbiAgICAgIGlzRnVuY3Rpb24odmFsdWUuaW5zcGVjdCkgJiZcbiAgICAgIC8vIEZpbHRlciBvdXQgdGhlIHV0aWwgbW9kdWxlLCBpdCdzIGluc3BlY3QgZnVuY3Rpb24gaXMgc3BlY2lhbFxuICAgICAgdmFsdWUuaW5zcGVjdCAhPT0gZXhwb3J0cy5pbnNwZWN0ICYmXG4gICAgICAvLyBBbHNvIGZpbHRlciBvdXQgYW55IHByb3RvdHlwZSBvYmplY3RzIHVzaW5nIHRoZSBjaXJjdWxhciBjaGVjay5cbiAgICAgICEodmFsdWUuY29uc3RydWN0b3IgJiYgdmFsdWUuY29uc3RydWN0b3IucHJvdG90eXBlID09PSB2YWx1ZSkpIHtcbiAgICB2YXIgcmV0ID0gdmFsdWUuaW5zcGVjdChyZWN1cnNlVGltZXMsIGN0eCk7XG4gICAgaWYgKCFpc1N0cmluZyhyZXQpKSB7XG4gICAgICByZXQgPSBmb3JtYXRWYWx1ZShjdHgsIHJldCwgcmVjdXJzZVRpbWVzKTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIC8vIFByaW1pdGl2ZSB0eXBlcyBjYW5ub3QgaGF2ZSBwcm9wZXJ0aWVzXG4gIHZhciBwcmltaXRpdmUgPSBmb3JtYXRQcmltaXRpdmUoY3R4LCB2YWx1ZSk7XG4gIGlmIChwcmltaXRpdmUpIHtcbiAgICByZXR1cm4gcHJpbWl0aXZlO1xuICB9XG5cbiAgLy8gTG9vayB1cCB0aGUga2V5cyBvZiB0aGUgb2JqZWN0LlxuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlKTtcbiAgdmFyIHZpc2libGVLZXlzID0gYXJyYXlUb0hhc2goa2V5cyk7XG5cbiAgaWYgKGN0eC5zaG93SGlkZGVuKSB7XG4gICAga2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHZhbHVlKTtcbiAgfVxuXG4gIC8vIElFIGRvZXNuJ3QgbWFrZSBlcnJvciBmaWVsZHMgbm9uLWVudW1lcmFibGVcbiAgLy8gaHR0cDovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L2llL2R3dzUyc2J0KHY9dnMuOTQpLmFzcHhcbiAgaWYgKGlzRXJyb3IodmFsdWUpXG4gICAgICAmJiAoa2V5cy5pbmRleE9mKCdtZXNzYWdlJykgPj0gMCB8fCBrZXlzLmluZGV4T2YoJ2Rlc2NyaXB0aW9uJykgPj0gMCkpIHtcbiAgICByZXR1cm4gZm9ybWF0RXJyb3IodmFsdWUpO1xuICB9XG5cbiAgLy8gU29tZSB0eXBlIG9mIG9iamVjdCB3aXRob3V0IHByb3BlcnRpZXMgY2FuIGJlIHNob3J0Y3V0dGVkLlxuICBpZiAoa2V5cy5sZW5ndGggPT09IDApIHtcbiAgICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICAgIHZhciBuYW1lID0gdmFsdWUubmFtZSA/ICc6ICcgKyB2YWx1ZS5uYW1lIDogJyc7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJ1tGdW5jdGlvbicgKyBuYW1lICsgJ10nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ3JlZ2V4cCcpO1xuICAgIH1cbiAgICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKERhdGUucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAnZGF0ZScpO1xuICAgIH1cbiAgICBpZiAoaXNFcnJvcih2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgdmFyIGJhc2UgPSAnJywgYXJyYXkgPSBmYWxzZSwgYnJhY2VzID0gWyd7JywgJ30nXTtcblxuICAvLyBNYWtlIEFycmF5IHNheSB0aGF0IHRoZXkgYXJlIEFycmF5XG4gIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgIGFycmF5ID0gdHJ1ZTtcbiAgICBicmFjZXMgPSBbJ1snLCAnXSddO1xuICB9XG5cbiAgLy8gTWFrZSBmdW5jdGlvbnMgc2F5IHRoYXQgdGhleSBhcmUgZnVuY3Rpb25zXG4gIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgIHZhciBuID0gdmFsdWUubmFtZSA/ICc6ICcgKyB2YWx1ZS5uYW1lIDogJyc7XG4gICAgYmFzZSA9ICcgW0Z1bmN0aW9uJyArIG4gKyAnXSc7XG4gIH1cblxuICAvLyBNYWtlIFJlZ0V4cHMgc2F5IHRoYXQgdGhleSBhcmUgUmVnRXhwc1xuICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSk7XG4gIH1cblxuICAvLyBNYWtlIGRhdGVzIHdpdGggcHJvcGVydGllcyBmaXJzdCBzYXkgdGhlIGRhdGVcbiAgaWYgKGlzRGF0ZSh2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgRGF0ZS5wcm90b3R5cGUudG9VVENTdHJpbmcuY2FsbCh2YWx1ZSk7XG4gIH1cblxuICAvLyBNYWtlIGVycm9yIHdpdGggbWVzc2FnZSBmaXJzdCBzYXkgdGhlIGVycm9yXG4gIGlmIChpc0Vycm9yKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gIH1cblxuICBpZiAoa2V5cy5sZW5ndGggPT09IDAgJiYgKCFhcnJheSB8fCB2YWx1ZS5sZW5ndGggPT0gMCkpIHtcbiAgICByZXR1cm4gYnJhY2VzWzBdICsgYmFzZSArIGJyYWNlc1sxXTtcbiAgfVxuXG4gIGlmIChyZWN1cnNlVGltZXMgPCAwKSB7XG4gICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdyZWdleHAnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCdbT2JqZWN0XScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG5cbiAgY3R4LnNlZW4ucHVzaCh2YWx1ZSk7XG5cbiAgdmFyIG91dHB1dDtcbiAgaWYgKGFycmF5KSB7XG4gICAgb3V0cHV0ID0gZm9ybWF0QXJyYXkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5cyk7XG4gIH0gZWxzZSB7XG4gICAgb3V0cHV0ID0ga2V5cy5tYXAoZnVuY3Rpb24oa2V5KSB7XG4gICAgICByZXR1cm4gZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5LCBhcnJheSk7XG4gICAgfSk7XG4gIH1cblxuICBjdHguc2Vlbi5wb3AoKTtcblxuICByZXR1cm4gcmVkdWNlVG9TaW5nbGVTdHJpbmcob3V0cHV0LCBiYXNlLCBicmFjZXMpO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFByaW1pdGl2ZShjdHgsIHZhbHVlKSB7XG4gIGlmIChpc1VuZGVmaW5lZCh2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCd1bmRlZmluZWQnLCAndW5kZWZpbmVkJyk7XG4gIGlmIChpc1N0cmluZyh2YWx1ZSkpIHtcbiAgICB2YXIgc2ltcGxlID0gJ1xcJycgKyBKU09OLnN0cmluZ2lmeSh2YWx1ZSkucmVwbGFjZSgvXlwifFwiJC9nLCAnJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJykgKyAnXFwnJztcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoc2ltcGxlLCAnc3RyaW5nJyk7XG4gIH1cbiAgaWYgKGlzTnVtYmVyKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJycgKyB2YWx1ZSwgJ251bWJlcicpO1xuICBpZiAoaXNCb29sZWFuKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJycgKyB2YWx1ZSwgJ2Jvb2xlYW4nKTtcbiAgLy8gRm9yIHNvbWUgcmVhc29uIHR5cGVvZiBudWxsIGlzIFwib2JqZWN0XCIsIHNvIHNwZWNpYWwgY2FzZSBoZXJlLlxuICBpZiAoaXNOdWxsKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJ251bGwnLCAnbnVsbCcpO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdEVycm9yKHZhbHVlKSB7XG4gIHJldHVybiAnWycgKyBFcnJvci5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgKyAnXSc7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0QXJyYXkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5cykge1xuICB2YXIgb3V0cHV0ID0gW107XG4gIGZvciAodmFyIGkgPSAwLCBsID0gdmFsdWUubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgaWYgKGhhc093blByb3BlcnR5KHZhbHVlLCBTdHJpbmcoaSkpKSB7XG4gICAgICBvdXRwdXQucHVzaChmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLFxuICAgICAgICAgIFN0cmluZyhpKSwgdHJ1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdXRwdXQucHVzaCgnJyk7XG4gICAgfVxuICB9XG4gIGtleXMuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICBpZiAoIWtleS5tYXRjaCgvXlxcZCskLykpIHtcbiAgICAgIG91dHB1dC5wdXNoKGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsXG4gICAgICAgICAga2V5LCB0cnVlKSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXksIGFycmF5KSB7XG4gIHZhciBuYW1lLCBzdHIsIGRlc2M7XG4gIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHZhbHVlLCBrZXkpIHx8IHsgdmFsdWU6IHZhbHVlW2tleV0gfTtcbiAgaWYgKGRlc2MuZ2V0KSB7XG4gICAgaWYgKGRlc2Muc2V0KSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0dldHRlci9TZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tHZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKGRlc2Muc2V0KSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuICBpZiAoIWhhc093blByb3BlcnR5KHZpc2libGVLZXlzLCBrZXkpKSB7XG4gICAgbmFtZSA9ICdbJyArIGtleSArICddJztcbiAgfVxuICBpZiAoIXN0cikge1xuICAgIGlmIChjdHguc2Vlbi5pbmRleE9mKGRlc2MudmFsdWUpIDwgMCkge1xuICAgICAgaWYgKGlzTnVsbChyZWN1cnNlVGltZXMpKSB7XG4gICAgICAgIHN0ciA9IGZvcm1hdFZhbHVlKGN0eCwgZGVzYy52YWx1ZSwgbnVsbCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgPSBmb3JtYXRWYWx1ZShjdHgsIGRlc2MudmFsdWUsIHJlY3Vyc2VUaW1lcyAtIDEpO1xuICAgICAgfVxuICAgICAgaWYgKHN0ci5pbmRleE9mKCdcXG4nKSA+IC0xKSB7XG4gICAgICAgIGlmIChhcnJheSkge1xuICAgICAgICAgIHN0ciA9IHN0ci5zcGxpdCgnXFxuJykubWFwKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgICAgIHJldHVybiAnICAnICsgbGluZTtcbiAgICAgICAgICB9KS5qb2luKCdcXG4nKS5zdWJzdHIoMik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RyID0gJ1xcbicgKyBzdHIuc3BsaXQoJ1xcbicpLm1hcChmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgICAgICByZXR1cm4gJyAgICcgKyBsaW5lO1xuICAgICAgICAgIH0pLmpvaW4oJ1xcbicpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbQ2lyY3VsYXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cbiAgaWYgKGlzVW5kZWZpbmVkKG5hbWUpKSB7XG4gICAgaWYgKGFycmF5ICYmIGtleS5tYXRjaCgvXlxcZCskLykpIHtcbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICAgIG5hbWUgPSBKU09OLnN0cmluZ2lmeSgnJyArIGtleSk7XG4gICAgaWYgKG5hbWUubWF0Y2goL15cIihbYS16QS1aX11bYS16QS1aXzAtOV0qKVwiJC8pKSB7XG4gICAgICBuYW1lID0gbmFtZS5zdWJzdHIoMSwgbmFtZS5sZW5ndGggLSAyKTtcbiAgICAgIG5hbWUgPSBjdHguc3R5bGl6ZShuYW1lLCAnbmFtZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuYW1lID0gbmFtZS5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFxcIi9nLCAnXCInKVxuICAgICAgICAgICAgICAgICAucmVwbGFjZSgvKF5cInxcIiQpL2csIFwiJ1wiKTtcbiAgICAgIG5hbWUgPSBjdHguc3R5bGl6ZShuYW1lLCAnc3RyaW5nJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5hbWUgKyAnOiAnICsgc3RyO1xufVxuXG5cbmZ1bmN0aW9uIHJlZHVjZVRvU2luZ2xlU3RyaW5nKG91dHB1dCwgYmFzZSwgYnJhY2VzKSB7XG4gIHZhciBudW1MaW5lc0VzdCA9IDA7XG4gIHZhciBsZW5ndGggPSBvdXRwdXQucmVkdWNlKGZ1bmN0aW9uKHByZXYsIGN1cikge1xuICAgIG51bUxpbmVzRXN0Kys7XG4gICAgaWYgKGN1ci5pbmRleE9mKCdcXG4nKSA+PSAwKSBudW1MaW5lc0VzdCsrO1xuICAgIHJldHVybiBwcmV2ICsgY3VyLnJlcGxhY2UoL1xcdTAwMWJcXFtcXGRcXGQ/bS9nLCAnJykubGVuZ3RoICsgMTtcbiAgfSwgMCk7XG5cbiAgaWYgKGxlbmd0aCA+IDYwKSB7XG4gICAgcmV0dXJuIGJyYWNlc1swXSArXG4gICAgICAgICAgIChiYXNlID09PSAnJyA/ICcnIDogYmFzZSArICdcXG4gJykgK1xuICAgICAgICAgICAnICcgK1xuICAgICAgICAgICBvdXRwdXQuam9pbignLFxcbiAgJykgK1xuICAgICAgICAgICAnICcgK1xuICAgICAgICAgICBicmFjZXNbMV07XG4gIH1cblxuICByZXR1cm4gYnJhY2VzWzBdICsgYmFzZSArICcgJyArIG91dHB1dC5qb2luKCcsICcpICsgJyAnICsgYnJhY2VzWzFdO1xufVxuXG5cbi8vIE5PVEU6IFRoZXNlIHR5cGUgY2hlY2tpbmcgZnVuY3Rpb25zIGludGVudGlvbmFsbHkgZG9uJ3QgdXNlIGBpbnN0YW5jZW9mYFxuLy8gYmVjYXVzZSBpdCBpcyBmcmFnaWxlIGFuZCBjYW4gYmUgZWFzaWx5IGZha2VkIHdpdGggYE9iamVjdC5jcmVhdGUoKWAuXG5mdW5jdGlvbiBpc0FycmF5KGFyKSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KGFyKTtcbn1cbmV4cG9ydHMuaXNBcnJheSA9IGlzQXJyYXk7XG5cbmZ1bmN0aW9uIGlzQm9vbGVhbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdib29sZWFuJztcbn1cbmV4cG9ydHMuaXNCb29sZWFuID0gaXNCb29sZWFuO1xuXG5mdW5jdGlvbiBpc051bGwoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbCA9IGlzTnVsbDtcblxuZnVuY3Rpb24gaXNOdWxsT3JVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsT3JVbmRlZmluZWQgPSBpc051bGxPclVuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cbmV4cG9ydHMuaXNOdW1iZXIgPSBpc051bWJlcjtcblxuZnVuY3Rpb24gaXNTdHJpbmcoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnc3RyaW5nJztcbn1cbmV4cG9ydHMuaXNTdHJpbmcgPSBpc1N0cmluZztcblxuZnVuY3Rpb24gaXNTeW1ib2woYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnc3ltYm9sJztcbn1cbmV4cG9ydHMuaXNTeW1ib2wgPSBpc1N5bWJvbDtcblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbmV4cG9ydHMuaXNVbmRlZmluZWQgPSBpc1VuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNSZWdFeHAocmUpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KHJlKSAmJiBvYmplY3RUb1N0cmluZyhyZSkgPT09ICdbb2JqZWN0IFJlZ0V4cF0nO1xufVxuZXhwb3J0cy5pc1JlZ0V4cCA9IGlzUmVnRXhwO1xuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNPYmplY3QgPSBpc09iamVjdDtcblxuZnVuY3Rpb24gaXNEYXRlKGQpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KGQpICYmIG9iamVjdFRvU3RyaW5nKGQpID09PSAnW29iamVjdCBEYXRlXSc7XG59XG5leHBvcnRzLmlzRGF0ZSA9IGlzRGF0ZTtcblxuZnVuY3Rpb24gaXNFcnJvcihlKSB7XG4gIHJldHVybiBpc09iamVjdChlKSAmJlxuICAgICAgKG9iamVjdFRvU3RyaW5nKGUpID09PSAnW29iamVjdCBFcnJvcl0nIHx8IGUgaW5zdGFuY2VvZiBFcnJvcik7XG59XG5leHBvcnRzLmlzRXJyb3IgPSBpc0Vycm9yO1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cbmV4cG9ydHMuaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XG5cbmZ1bmN0aW9uIGlzUHJpbWl0aXZlKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnYm9vbGVhbicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdudW1iZXInIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCcgfHwgIC8vIEVTNiBzeW1ib2xcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICd1bmRlZmluZWQnO1xufVxuZXhwb3J0cy5pc1ByaW1pdGl2ZSA9IGlzUHJpbWl0aXZlO1xuXG5leHBvcnRzLmlzQnVmZmVyID0gcmVxdWlyZSgnLi9zdXBwb3J0L2lzQnVmZmVyJyk7XG5cbmZ1bmN0aW9uIG9iamVjdFRvU3RyaW5nKG8pIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKTtcbn1cblxuXG5mdW5jdGlvbiBwYWQobikge1xuICByZXR1cm4gbiA8IDEwID8gJzAnICsgbi50b1N0cmluZygxMCkgOiBuLnRvU3RyaW5nKDEwKTtcbn1cblxuXG52YXIgbW9udGhzID0gWydKYW4nLCAnRmViJywgJ01hcicsICdBcHInLCAnTWF5JywgJ0p1bicsICdKdWwnLCAnQXVnJywgJ1NlcCcsXG4gICAgICAgICAgICAgICdPY3QnLCAnTm92JywgJ0RlYyddO1xuXG4vLyAyNiBGZWIgMTY6MTk6MzRcbmZ1bmN0aW9uIHRpbWVzdGFtcCgpIHtcbiAgdmFyIGQgPSBuZXcgRGF0ZSgpO1xuICB2YXIgdGltZSA9IFtwYWQoZC5nZXRIb3VycygpKSxcbiAgICAgICAgICAgICAgcGFkKGQuZ2V0TWludXRlcygpKSxcbiAgICAgICAgICAgICAgcGFkKGQuZ2V0U2Vjb25kcygpKV0uam9pbignOicpO1xuICByZXR1cm4gW2QuZ2V0RGF0ZSgpLCBtb250aHNbZC5nZXRNb250aCgpXSwgdGltZV0uam9pbignICcpO1xufVxuXG5cbi8vIGxvZyBpcyBqdXN0IGEgdGhpbiB3cmFwcGVyIHRvIGNvbnNvbGUubG9nIHRoYXQgcHJlcGVuZHMgYSB0aW1lc3RhbXBcbmV4cG9ydHMubG9nID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUubG9nKCclcyAtICVzJywgdGltZXN0YW1wKCksIGV4cG9ydHMuZm9ybWF0LmFwcGx5KGV4cG9ydHMsIGFyZ3VtZW50cykpO1xufTtcblxuXG4vKipcbiAqIEluaGVyaXQgdGhlIHByb3RvdHlwZSBtZXRob2RzIGZyb20gb25lIGNvbnN0cnVjdG9yIGludG8gYW5vdGhlci5cbiAqXG4gKiBUaGUgRnVuY3Rpb24ucHJvdG90eXBlLmluaGVyaXRzIGZyb20gbGFuZy5qcyByZXdyaXR0ZW4gYXMgYSBzdGFuZGFsb25lXG4gKiBmdW5jdGlvbiAobm90IG9uIEZ1bmN0aW9uLnByb3RvdHlwZSkuIE5PVEU6IElmIHRoaXMgZmlsZSBpcyB0byBiZSBsb2FkZWRcbiAqIGR1cmluZyBib290c3RyYXBwaW5nIHRoaXMgZnVuY3Rpb24gbmVlZHMgdG8gYmUgcmV3cml0dGVuIHVzaW5nIHNvbWUgbmF0aXZlXG4gKiBmdW5jdGlvbnMgYXMgcHJvdG90eXBlIHNldHVwIHVzaW5nIG5vcm1hbCBKYXZhU2NyaXB0IGRvZXMgbm90IHdvcmsgYXNcbiAqIGV4cGVjdGVkIGR1cmluZyBib290c3RyYXBwaW5nIChzZWUgbWlycm9yLmpzIGluIHIxMTQ5MDMpLlxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGN0b3IgQ29uc3RydWN0b3IgZnVuY3Rpb24gd2hpY2ggbmVlZHMgdG8gaW5oZXJpdCB0aGVcbiAqICAgICBwcm90b3R5cGUuXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBzdXBlckN0b3IgQ29uc3RydWN0b3IgZnVuY3Rpb24gdG8gaW5oZXJpdCBwcm90b3R5cGUgZnJvbS5cbiAqL1xuZXhwb3J0cy5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG5cbmV4cG9ydHMuX2V4dGVuZCA9IGZ1bmN0aW9uKG9yaWdpbiwgYWRkKSB7XG4gIC8vIERvbid0IGRvIGFueXRoaW5nIGlmIGFkZCBpc24ndCBhbiBvYmplY3RcbiAgaWYgKCFhZGQgfHwgIWlzT2JqZWN0KGFkZCkpIHJldHVybiBvcmlnaW47XG5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhhZGQpO1xuICB2YXIgaSA9IGtleXMubGVuZ3RoO1xuICB3aGlsZSAoaS0tKSB7XG4gICAgb3JpZ2luW2tleXNbaV1dID0gYWRkW2tleXNbaV1dO1xuICB9XG4gIHJldHVybiBvcmlnaW47XG59O1xuXG5mdW5jdGlvbiBoYXNPd25Qcm9wZXJ0eShvYmosIHByb3ApIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApO1xufVxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIklyWFVzdVwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3V0aWwvdXRpbC5qc1wiLFwiL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3V0aWxcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgTm9ibGUgPSByZXF1aXJlKCcuL2xpYi9ub2JsZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBOb2JsZSgpO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIklyWFVzdVwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL25vZGVfbW9kdWxlcy9ub2JsZS9pbmRleC5qc1wiLFwiL25vZGVfbW9kdWxlcy9ub2JsZVwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBldmVudHMgPSByZXF1aXJlKCdldmVudHMnKTtcbnZhciB1dGlsID0gcmVxdWlyZSgndXRpbCcpO1xuXG52YXIgZGVidWcgPSByZXF1aXJlKCdkZWJ1ZycpKCdiaW5kaW5ncycpO1xuXG5cbnZhciBOb2JsZUJpbmRpbmdzID0gZnVuY3Rpb24oKSB7XG5cblxuICBjb25zb2xlLmxvZygnY2hyb21lIG5vYmxlIGJpbmRpbmdzJyk7XG5cbiAgdGhpcy5fc3RhcnRTY2FuQ29tbWFuZCA9IG51bGw7XG4gIHRoaXMuX3BlcmlwaGVyYWxzID0ge307XG5cbiAgdGhpcy5vbignbWVzc2FnZScsIHRoaXMuX29uTWVzc2FnZS5iaW5kKHRoaXMpKTtcbn07XG5cbnV0aWwuaW5oZXJpdHMoTm9ibGVCaW5kaW5ncywgZXZlbnRzLkV2ZW50RW1pdHRlcik7XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLl9vbk9wZW4gPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJ29uIC0+IG9wZW4nKTtcbn07XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLl9vbkNsb3NlID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUubG9nKCdvbiAtPiBjbG9zZScpO1xuXG4gIHRoaXMuZW1pdCgnc3RhdGVDaGFuZ2UnLCAncG93ZXJlZE9mZicpO1xufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUuX29uTWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gIHZhciB0eXBlID0gZXZlbnQudHlwZTtcbiAgdmFyIHBlcmlwaGVyYWxVdWlkID0gZXZlbnQucGVyaXBoZXJhbFV1aWQ7XG4gIHZhciBhZHZlcnRpc2VtZW50ID0gZXZlbnQuYWR2ZXJ0aXNlbWVudDtcbiAgdmFyIHJzc2kgPSBldmVudC5yc3NpO1xuICB2YXIgc2VydmljZVV1aWRzID0gZXZlbnQuc2VydmljZVV1aWRzO1xuICB2YXIgc2VydmljZVV1aWQgPSBldmVudC5zZXJ2aWNlVXVpZDtcbiAgdmFyIGluY2x1ZGVkU2VydmljZVV1aWRzID0gZXZlbnQuaW5jbHVkZWRTZXJ2aWNlVXVpZHM7XG4gIHZhciBjaGFyYWN0ZXJpc3RpY3MgPSBldmVudC5jaGFyYWN0ZXJpc3RpY3M7XG4gIHZhciBjaGFyYWN0ZXJpc3RpY1V1aWQgPSBldmVudC5jaGFyYWN0ZXJpc3RpY1V1aWQ7XG4gIHZhciBkYXRhID0gZXZlbnQuZGF0YSA/IG5ldyBCdWZmZXIoZXZlbnQuZGF0YSwgJ2hleCcpIDogbnVsbDtcbiAgdmFyIGlzTm90aWZpY2F0aW9uID0gZXZlbnQuaXNOb3RpZmljYXRpb247XG4gIHZhciBzdGF0ZSA9IGV2ZW50LnN0YXRlO1xuICB2YXIgZGVzY3JpcHRvcnMgPSBldmVudC5kZXNjcmlwdG9ycztcbiAgdmFyIGRlc2NyaXB0b3JVdWlkID0gZXZlbnQuZGVzY3JpcHRvclV1aWQ7XG4gIHZhciBoYW5kbGUgPSBldmVudC5oYW5kbGU7XG5cbiAgaWYgKHR5cGUgPT09ICdzdGF0ZUNoYW5nZScpIHtcbiAgICBjb25zb2xlLmxvZyhzdGF0ZSk7XG4gICAgdGhpcy5lbWl0KCdzdGF0ZUNoYW5nZScsIHN0YXRlKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnZGlzY292ZXInKSB7XG4gICAgYWR2ZXJ0aXNlbWVudCA9IHtcbiAgICAgIGxvY2FsTmFtZTogYWR2ZXJ0aXNlbWVudC5sb2NhbE5hbWUsXG4gICAgICB0eFBvd2VyTGV2ZWw6IGFkdmVydGlzZW1lbnQudHhQb3dlckxldmVsLFxuICAgICAgc2VydmljZVV1aWRzOiBhZHZlcnRpc2VtZW50LnNlcnZpY2VVdWlkcyxcbiAgICAgIG1hbnVmYWN0dXJlckRhdGE6IChhZHZlcnRpc2VtZW50Lm1hbnVmYWN0dXJlckRhdGEgPyBuZXcgQnVmZmVyKGFkdmVydGlzZW1lbnQubWFudWZhY3R1cmVyRGF0YSwgJ2hleCcpIDogbnVsbCksXG4gICAgICBzZXJ2aWNlRGF0YTogKGFkdmVydGlzZW1lbnQuc2VydmljZURhdGEgPyBuZXcgQnVmZmVyKGFkdmVydGlzZW1lbnQuc2VydmljZURhdGEsICdoZXgnKSA6IG51bGwpXG4gICAgfTtcblxuICAgIHRoaXMuX3BlcmlwaGVyYWxzW3BlcmlwaGVyYWxVdWlkXSA9IHtcbiAgICAgIHV1aWQ6IHBlcmlwaGVyYWxVdWlkLFxuICAgICAgYWR2ZXJ0aXNlbWVudDogYWR2ZXJ0aXNlbWVudCxcbiAgICAgIHJzc2k6IHJzc2lcbiAgICB9O1xuXG4gICAgdGhpcy5lbWl0KCdkaXNjb3ZlcicsIHBlcmlwaGVyYWxVdWlkLCBhZHZlcnRpc2VtZW50LCByc3NpKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnY29ubmVjdCcpIHtcbiAgICB0aGlzLmVtaXQoJ2Nvbm5lY3QnLCBwZXJpcGhlcmFsVXVpZCk7XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2Rpc2Nvbm5lY3QnKSB7XG4gICAgdGhpcy5lbWl0KCdkaXNjb25uZWN0JywgcGVyaXBoZXJhbFV1aWQpO1xuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdyc3NpVXBkYXRlJykge1xuICAgIHRoaXMuZW1pdCgncnNzaVVwZGF0ZScsIHBlcmlwaGVyYWxVdWlkLCByc3NpKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnc2VydmljZXNEaXNjb3ZlcicpIHtcbiAgICB0aGlzLmVtaXQoJ3NlcnZpY2VzRGlzY292ZXInLCBwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWRzKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnaW5jbHVkZWRTZXJ2aWNlc0Rpc2NvdmVyJykge1xuICAgIHRoaXMuZW1pdCgnaW5jbHVkZWRTZXJ2aWNlc0Rpc2NvdmVyJywgcGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBpbmNsdWRlZFNlcnZpY2VVdWlkcyk7XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2NoYXJhY3RlcmlzdGljc0Rpc2NvdmVyJykge1xuICAgIHRoaXMuZW1pdCgnY2hhcmFjdGVyaXN0aWNzRGlzY292ZXInLCBwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljcyk7XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3JlYWQnKSB7XG4gICAgdGhpcy5lbWl0KCdyZWFkJywgcGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIGRhdGEsIGlzTm90aWZpY2F0aW9uKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnd3JpdGUnKSB7XG4gICAgdGhpcy5lbWl0KCd3cml0ZScsIHBlcmlwaGVyYWxVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnYnJvYWRjYXN0Jykge1xuICAgIHRoaXMuZW1pdCgnYnJvYWRjYXN0JywgcGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIHN0YXRlKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbm90aWZ5Jykge1xuICAgIHRoaXMuZW1pdCgnbm90aWZ5JywgcGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIHN0YXRlKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnZGVzY3JpcHRvcnNEaXNjb3ZlcicpIHtcbiAgICB0aGlzLmVtaXQoJ2Rlc2NyaXB0b3JzRGlzY292ZXInLCBwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgZGVzY3JpcHRvcnMpO1xuICB9IGVsc2UgaWYgKHR5cGUgPT09ICd2YWx1ZVJlYWQnKSB7XG4gICAgdGhpcy5lbWl0KCd2YWx1ZVJlYWQnLCBwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgZGVzY3JpcHRvclV1aWQsIGRhdGEpO1xuICB9IGVsc2UgaWYgKHR5cGUgPT09ICd2YWx1ZVdyaXRlJykge1xuICAgIHRoaXMuZW1pdCgndmFsdWVXcml0ZScsIHBlcmlwaGVyYWxVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBkZXNjcmlwdG9yVXVpZCk7XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2hhbmRsZVJlYWQnKSB7XG4gICAgdGhpcy5lbWl0KCdoYW5kbGVSZWFkJywgaGFuZGxlLCBkYXRhKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnaGFuZGxlV3JpdGUnKSB7XG4gICAgdGhpcy5lbWl0KCdoYW5kbGVXcml0ZScsIGhhbmRsZSk7XG4gIH1cbn07XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLl9zZW5kQ29tbWFuZCA9IGZ1bmN0aW9uKGNvbW1hbmQpIHtcbiAgdmFyIG1lc3NhZ2UgPSBKU09OLnN0cmluZ2lmeShjb21tYW5kKTtcblxuICB0aGlzLl93cy5zZW5kKG1lc3NhZ2UpO1xufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUuc3RhcnRTY2FubmluZyA9IGZ1bmN0aW9uKHNlcnZpY2VVdWlkcywgYWxsb3dEdXBsaWNhdGVzKSB7XG4gIHRoaXMuX3N0YXJ0U2NhbkNvbW1hbmQgPSB7XG4gICAgYWN0aW9uOiAnc3RhcnRTY2FubmluZycsXG4gICAgc2VydmljZVV1aWRzOiBzZXJ2aWNlVXVpZHMsXG4gICAgYWxsb3dEdXBsaWNhdGVzOiBhbGxvd0R1cGxpY2F0ZXNcbiAgfTtcbiAgdGhpcy5fc2VuZENvbW1hbmQodGhpcy5fc3RhcnRTY2FuQ29tbWFuZCk7XG5cbiAgdGhpcy5lbWl0KCdzY2FuU3RhcnQnKTtcbn07XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLnN0b3BTY2FubmluZyA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLl9zdGFydFNjYW5Db21tYW5kID0gbnVsbDtcblxuICB0aGlzLl9zZW5kQ29tbWFuZCh7XG4gICAgYWN0aW9uOiAnc3RvcFNjYW5uaW5nJ1xuICB9KTtcblxuICB0aGlzLmVtaXQoJ3NjYW5TdG9wJyk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oZGV2aWNlVXVpZCkge1xuICB2YXIgcGVyaXBoZXJhbCA9IHRoaXMuX3BlcmlwaGVyYWxzW2RldmljZVV1aWRdO1xuXG4gIHRoaXMuX3NlbmRDb21tYW5kKHtcbiAgICBhY3Rpb246ICdjb25uZWN0JyxcbiAgICBwZXJpcGhlcmFsVXVpZDogcGVyaXBoZXJhbC51dWlkXG4gIH0pO1xufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUuZGlzY29ubmVjdCA9IGZ1bmN0aW9uKGRldmljZVV1aWQpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1tkZXZpY2VVdWlkXTtcblxuICB0aGlzLl9zZW5kQ29tbWFuZCh7XG4gICAgYWN0aW9uOiAnZGlzY29ubmVjdCcsXG4gICAgcGVyaXBoZXJhbFV1aWQ6IHBlcmlwaGVyYWwudXVpZFxuICB9KTtcbn07XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLnVwZGF0ZVJzc2kgPSBmdW5jdGlvbihkZXZpY2VVdWlkKSB7XG4gIHZhciBwZXJpcGhlcmFsID0gdGhpcy5fcGVyaXBoZXJhbHNbZGV2aWNlVXVpZF07XG5cbiAgdGhpcy5fc2VuZENvbW1hbmQoe1xuICAgIGFjdGlvbjogJ3VwZGF0ZVJzc2knLFxuICAgIHBlcmlwaGVyYWxVdWlkOiBwZXJpcGhlcmFsLnV1aWRcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5kaXNjb3ZlclNlcnZpY2VzID0gZnVuY3Rpb24oZGV2aWNlVXVpZCwgdXVpZHMpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1tkZXZpY2VVdWlkXTtcblxuICB0aGlzLl9zZW5kQ29tbWFuZCh7XG4gICAgYWN0aW9uOiAnZGlzY292ZXJTZXJ2aWNlcycsXG4gICAgcGVyaXBoZXJhbFV1aWQ6IHBlcmlwaGVyYWwudXVpZCxcbiAgICB1dWlkczogdXVpZHNcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5kaXNjb3ZlckluY2x1ZGVkU2VydmljZXMgPSBmdW5jdGlvbihkZXZpY2VVdWlkLCBzZXJ2aWNlVXVpZCwgc2VydmljZVV1aWRzKSB7XG4gIHZhciBwZXJpcGhlcmFsID0gdGhpcy5fcGVyaXBoZXJhbHNbZGV2aWNlVXVpZF07XG5cbiAgdGhpcy5fc2VuZENvbW1hbmQoe1xuICAgIGFjdGlvbjogJ2Rpc2NvdmVySW5jbHVkZWRTZXJ2aWNlcycsXG4gICAgcGVyaXBoZXJhbFV1aWQ6IHBlcmlwaGVyYWwudXVpZCxcbiAgICBzZXJ2aWNlVXVpZDogc2VydmljZVV1aWQsXG4gICAgc2VydmljZVV1aWRzOiBzZXJ2aWNlVXVpZHNcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5kaXNjb3ZlckNoYXJhY3RlcmlzdGljcyA9IGZ1bmN0aW9uKGRldmljZVV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWRzKSB7XG4gIHZhciBwZXJpcGhlcmFsID0gdGhpcy5fcGVyaXBoZXJhbHNbZGV2aWNlVXVpZF07XG5cbiAgdGhpcy5fc2VuZENvbW1hbmQoe1xuICAgIGFjdGlvbjogJ2Rpc2NvdmVyQ2hhcmFjdGVyaXN0aWNzJyxcbiAgICBwZXJpcGhlcmFsVXVpZDogcGVyaXBoZXJhbC51dWlkLFxuICAgIHNlcnZpY2VVdWlkOiBzZXJ2aWNlVXVpZCxcbiAgICBjaGFyYWN0ZXJpc3RpY1V1aWRzOiBjaGFyYWN0ZXJpc3RpY1V1aWRzXG4gIH0pO1xufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUucmVhZCA9IGZ1bmN0aW9uKGRldmljZVV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1tkZXZpY2VVdWlkXTtcblxuICB0aGlzLl9zZW5kQ29tbWFuZCh7XG4gICAgYWN0aW9uOiAncmVhZCcsXG4gICAgcGVyaXBoZXJhbFV1aWQ6IHBlcmlwaGVyYWwudXVpZCxcbiAgICBzZXJ2aWNlVXVpZDogc2VydmljZVV1aWQsXG4gICAgY2hhcmFjdGVyaXN0aWNVdWlkOiBjaGFyYWN0ZXJpc3RpY1V1aWRcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uKGRldmljZVV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIGRhdGEsIHdpdGhvdXRSZXNwb25zZSkge1xuICB2YXIgcGVyaXBoZXJhbCA9IHRoaXMuX3BlcmlwaGVyYWxzW2RldmljZVV1aWRdO1xuXG4gIHRoaXMuX3NlbmRDb21tYW5kKHtcbiAgICBhY3Rpb246ICd3cml0ZScsXG4gICAgcGVyaXBoZXJhbFV1aWQ6IHBlcmlwaGVyYWwudXVpZCxcbiAgICBzZXJ2aWNlVXVpZDogc2VydmljZVV1aWQsXG4gICAgY2hhcmFjdGVyaXN0aWNVdWlkOiBjaGFyYWN0ZXJpc3RpY1V1aWQsXG4gICAgZGF0YTogZGF0YS50b1N0cmluZygnaGV4JyksXG4gICAgd2l0aG91dFJlc3BvbnNlOiB3aXRob3V0UmVzcG9uc2VcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5icm9hZGNhc3QgPSBmdW5jdGlvbihkZXZpY2VVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBicm9hZGNhc3QpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1tkZXZpY2VVdWlkXTtcblxuICB0aGlzLl9zZW5kQ29tbWFuZCh7XG4gICAgYWN0aW9uOiAnYnJvYWRjYXN0JyxcbiAgICBwZXJpcGhlcmFsVXVpZDogcGVyaXBoZXJhbC51dWlkLFxuICAgIHNlcnZpY2VVdWlkOiBzZXJ2aWNlVXVpZCxcbiAgICBjaGFyYWN0ZXJpc3RpY1V1aWQ6IGNoYXJhY3RlcmlzdGljVXVpZCxcbiAgICBicm9hZGNhc3Q6IGJyb2FkY2FzdFxuICB9KTtcbn07XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLm5vdGlmeSA9IGZ1bmN0aW9uKGRldmljZVV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIG5vdGlmeSkge1xuICB2YXIgcGVyaXBoZXJhbCA9IHRoaXMuX3BlcmlwaGVyYWxzW2RldmljZVV1aWRdO1xuXG4gIHRoaXMuX3NlbmRDb21tYW5kKHtcbiAgICBhY3Rpb246ICdub3RpZnknLFxuICAgIHBlcmlwaGVyYWxVdWlkOiBwZXJpcGhlcmFsLnV1aWQsXG4gICAgc2VydmljZVV1aWQ6IHNlcnZpY2VVdWlkLFxuICAgIGNoYXJhY3RlcmlzdGljVXVpZDogY2hhcmFjdGVyaXN0aWNVdWlkLFxuICAgIG5vdGlmeTogbm90aWZ5XG4gIH0pO1xufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUuZGlzY292ZXJEZXNjcmlwdG9ycyA9IGZ1bmN0aW9uKGRldmljZVV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1tkZXZpY2VVdWlkXTtcblxuICB0aGlzLl9zZW5kQ29tbWFuZCh7XG4gICAgYWN0aW9uOiAnZGlzY292ZXJEZXNjcmlwdG9ycycsXG4gICAgcGVyaXBoZXJhbFV1aWQ6IHBlcmlwaGVyYWwudXVpZCxcbiAgICBzZXJ2aWNlVXVpZDogc2VydmljZVV1aWQsXG4gICAgY2hhcmFjdGVyaXN0aWNVdWlkOiBjaGFyYWN0ZXJpc3RpY1V1aWRcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5yZWFkVmFsdWUgPSBmdW5jdGlvbihkZXZpY2VVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBkZXNjcmlwdG9yVXVpZCkge1xuICB2YXIgcGVyaXBoZXJhbCA9IHRoaXMuX3BlcmlwaGVyYWxzW2RldmljZVV1aWRdO1xuXG4gIHRoaXMuX3NlbmRDb21tYW5kKHtcbiAgICBhY3Rpb246ICdyZWFkVmFsdWUnLFxuICAgIHBlcmlwaGVyYWxVdWlkOiBwZXJpcGhlcmFsLnV1aWQsXG4gICAgc2VydmljZVV1aWQ6IHNlcnZpY2VVdWlkLFxuICAgIGNoYXJhY3RlcmlzdGljVXVpZDogY2hhcmFjdGVyaXN0aWNVdWlkLFxuICAgIGRlc2NyaXB0b3JVdWlkOiBkZXNjcmlwdG9yVXVpZFxuICB9KTtcbn07XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLndyaXRlVmFsdWUgPSBmdW5jdGlvbihkZXZpY2VVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBkZXNjcmlwdG9yVXVpZCwgZGF0YSkge1xuICB2YXIgcGVyaXBoZXJhbCA9IHRoaXMuX3BlcmlwaGVyYWxzW2RldmljZVV1aWRdO1xuXG4gIHRoaXMuX3NlbmRDb21tYW5kKHtcbiAgICBhY3Rpb246ICd3cml0ZVZhbHVlJyxcbiAgICBwZXJpcGhlcmFsVXVpZDogcGVyaXBoZXJhbC51dWlkLFxuICAgIHNlcnZpY2VVdWlkOiBzZXJ2aWNlVXVpZCxcbiAgICBjaGFyYWN0ZXJpc3RpY1V1aWQ6IGNoYXJhY3RlcmlzdGljVXVpZCxcbiAgICBkZXNjcmlwdG9yVXVpZDogZGVzY3JpcHRvclV1aWQsXG4gICAgZGF0YTogZGF0YS50b1N0cmluZygnaGV4JylcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5yZWFkSGFuZGxlID0gZnVuY3Rpb24oZGV2aWNlVXVpZCwgaGFuZGxlKSB7XG4gIHZhciBwZXJpcGhlcmFsID0gdGhpcy5fcGVyaXBoZXJhbHNbZGV2aWNlVXVpZF07XG5cbiAgdGhpcy5fc2VuZENvbW1hbmQoe1xuICAgIGFjdGlvbjogJ3JlYWRIYW5kbGUnLFxuICAgIHBlcmlwaGVyYWxVdWlkOiBwZXJpcGhlcmFsLnV1aWQsXG4gICAgaGFuZGxlOiBoYW5kbGVcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS53cml0ZUhhbmRsZSA9IGZ1bmN0aW9uKGRldmljZVV1aWQsIGhhbmRsZSwgZGF0YSwgd2l0aG91dFJlc3BvbnNlKSB7XG4gIHZhciBwZXJpcGhlcmFsID0gdGhpcy5fcGVyaXBoZXJhbHNbZGV2aWNlVXVpZF07XG5cbiAgdGhpcy5fc2VuZENvbW1hbmQoe1xuICAgIGFjdGlvbjogJ3JlYWRIYW5kbGUnLFxuICAgIHBlcmlwaGVyYWxVdWlkOiBwZXJpcGhlcmFsLnV1aWQsXG4gICAgaGFuZGxlOiBoYW5kbGUsXG4gICAgZGF0YTogZGF0YS50b1N0cmluZygnaGV4JyksXG4gICAgd2l0aG91dFJlc3BvbnNlOiB3aXRob3V0UmVzcG9uc2VcbiAgfSk7XG59O1xuXG52YXIgbm9ibGVCaW5kaW5ncyA9IG5ldyBOb2JsZUJpbmRpbmdzKCk7XG5cbm1vZHVsZS5leHBvcnRzID0gbm9ibGVCaW5kaW5ncztcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJJclhVc3VcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9ub2RlX21vZHVsZXMvbm9ibGUvbGliL2Jyb3dzZXIvY2hyb21lL2JpbmRpbmdzLmpzXCIsXCIvbm9kZV9tb2R1bGVzL25vYmxlL2xpYi9icm93c2VyL2Nocm9tZVwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbmlmKHdpbmRvdy5jaHJvbWUgJiYgd2luZG93LmNocm9tZS5ibHVldG9vdGhMb3dFbmVyZ3kpe1xuICBjb25zb2xlLmxvZygndXNpbmcgY2hyb21lIGFwcCBiaW5kaW5ncycpO1xuICBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vY2hyb21lL2JpbmRpbmdzJyk7XG59XG5lbHNlIGlmKHdpbmRvdy5ibHVldG9vdGhsZSl7XG4gIGNvbnNvbGUubG9nKCd1c2luZyBwaG9uZWdhcCBiaW5kaW5ncycpO1xuICBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vcGhvbmVnYXAvYmluZGluZ3MnKTtcbn1cbmVsc2V7XG4gIGNvbnNvbGUubG9nKCd1c2luZyB3ZWJzb2NrZXQgYmluZGluZ3MnKTtcbiAgbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3dlYnNvY2tldC9iaW5kaW5ncycpO1xufVxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIklyWFVzdVwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL25vZGVfbW9kdWxlcy9ub2JsZS9saWIvYnJvd3Nlci9pbmRleC5qc1wiLFwiL25vZGVfbW9kdWxlcy9ub2JsZS9saWIvYnJvd3NlclwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIGV2ZW50cyA9IHJlcXVpcmUoJ2V2ZW50cycpO1xudmFyIHV0aWwgPSByZXF1aXJlKCd1dGlsJyk7XG5cbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJykoJ2JpbmRpbmdzJyk7XG5cbnZhciBibGUgPSB3aW5kb3cuYmx1ZXRvb3RobGU7XG5cblxuLy9pbmNsdWRlZCBpbiBuZXdlciBibHVldG9vdGhMRVxuZnVuY3Rpb24gYnl0ZXNUb0VuY29kZWRTdHJpbmcoYnl0ZXMpIHtcbiAgcmV0dXJuIGJ0b2EoU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBieXRlcykpO1xufVxuXG5mdW5jdGlvbiBlcXVhbFV1aWRzKHV1aWQxLCB1dWlkMil7XG4gIGlmKCF1dWlkMSB8fCAhdXVpZDIpe1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB1dWlkMSA9IHV1aWQxLnRvTG93ZXJDYXNlKCkuc3BsaXQoJy0nKS5qb2luKCcnKS5zcGxpdCgnOicpLmpvaW4oJycpO1xuICB1dWlkMiA9IHV1aWQyLnRvTG93ZXJDYXNlKCkuc3BsaXQoJy0nKS5qb2luKCcnKS5zcGxpdCgnOicpLmpvaW4oJycpO1xuXG4gIGlmKHV1aWQxLmxlbmd0aCA9PT0gdXVpZDIubGVuZ3RoKXtcbiAgICByZXR1cm4gdXVpZDEgPT09IHV1aWQyO1xuICB9XG5cbiAgaWYodXVpZDEubGVuZ3RoID4gNCl7XG4gICAgdXVpZDEgPSB1dWlkMS5zdWJzdHJpbmcoNCw4KTtcbiAgfVxuXG4gIGlmKHV1aWQyLmxlbmd0aCA+IDQpe1xuICAgIHV1aWQyID0gdXVpZDIuc3Vic3RyaW5nKDQsOCk7XG4gIH1cblxuICAvL1RPRE8gNiBieXRlIHV1aWRzP1xuXG4gIHJldHVybiB1dWlkMSA9PT0gdXVpZDI7XG5cbn1cblxudmFyIE5vYmxlQmluZGluZ3MgPSBmdW5jdGlvbigpIHtcblxuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuZW5hYmxlZCA9IGZhbHNlO1xuICBzZWxmLl9wZXJpcGhlcmFscyA9IHt9O1xuICBzZWxmLnBsYXRmb3JtID0gbnVsbDtcblxuICBpZih0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuZGV2aWNlKXtcbiAgICBzZWxmLnBsYXRmb3JtID0gd2luZG93LmRldmljZS5wbGF0Zm9ybTtcbiAgfVxuICBjb25zb2xlLmxvZygnRGV2aWNlIFBsYXRmb3JtOiAnLCBzZWxmLnBsYXRmb3JtKTtcblxuICBjb25zb2xlLmxvZygncGhvbmVnYXAgKGJsdWV0b290aGxlKSBub2JsZSBiaW5kaW5ncycpO1xuXG4gIGJsZS5pbml0aWFsaXplKGZ1bmN0aW9uKGRhdGEpe1xuICAgIGlmKGRhdGEuc3RhdHVzID09PSAnZW5hYmxlZCcpe1xuICAgICAgc2VsZi5lbmFibGVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUubG9nKCdibGUgaW5pdGlhbGl6ZWQnKTtcbiAgICB9XG4gIH0sIGZ1bmN0aW9uKGVycil7XG4gICAgY29uc29sZS5sb2coJ2NhbnQgaW5pdGlhbGl6ZSBibGUnLCBlcnIpO1xuICB9LCB7cmVxdWVzdDogdHJ1ZX0pO1xuXG59O1xuXG51dGlsLmluaGVyaXRzKE5vYmxlQmluZGluZ3MsIGV2ZW50cy5FdmVudEVtaXR0ZXIpO1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5fb25PcGVuID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUubG9nKCdvbiAtPiBvcGVuJyk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5fb25DbG9zZSA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnb24gLT4gY2xvc2UnKTtcblxuICB0aGlzLmVtaXQoJ3N0YXRlQ2hhbmdlJywgJ3Bvd2VyZWRPZmYnKTtcbn07XG5cbi8vIE5vYmxlQmluZGluZ3MucHJvdG90eXBlLl9vbk1lc3NhZ2UgPSBmdW5jdGlvbihldmVudCkge1xuLy8gICB2YXIgdHlwZSA9IGV2ZW50LnR5cGU7XG4vLyAgIHZhciBwZXJpcGhlcmFsVXVpZCA9IGV2ZW50LnBlcmlwaGVyYWxVdWlkO1xuLy8gICB2YXIgYWR2ZXJ0aXNlbWVudCA9IGV2ZW50LmFkdmVydGlzZW1lbnQ7XG4vLyAgIHZhciByc3NpID0gZXZlbnQucnNzaTtcbi8vICAgdmFyIHNlcnZpY2VVdWlkcyA9IGV2ZW50LnNlcnZpY2VVdWlkcztcbi8vICAgdmFyIHNlcnZpY2VVdWlkID0gZXZlbnQuc2VydmljZVV1aWQ7XG4vLyAgIHZhciBpbmNsdWRlZFNlcnZpY2VVdWlkcyA9IGV2ZW50LmluY2x1ZGVkU2VydmljZVV1aWRzO1xuLy8gICB2YXIgY2hhcmFjdGVyaXN0aWNzID0gZXZlbnQuY2hhcmFjdGVyaXN0aWNzO1xuLy8gICB2YXIgY2hhcmFjdGVyaXN0aWNVdWlkID0gZXZlbnQuY2hhcmFjdGVyaXN0aWNVdWlkO1xuLy8gICB2YXIgZGF0YSA9IGV2ZW50LmRhdGEgPyBuZXcgQnVmZmVyKGV2ZW50LmRhdGEsICdoZXgnKSA6IG51bGw7XG4vLyAgIHZhciBpc05vdGlmaWNhdGlvbiA9IGV2ZW50LmlzTm90aWZpY2F0aW9uO1xuLy8gICB2YXIgc3RhdGUgPSBldmVudC5zdGF0ZTtcbi8vICAgdmFyIGRlc2NyaXB0b3JzID0gZXZlbnQuZGVzY3JpcHRvcnM7XG4vLyAgIHZhciBkZXNjcmlwdG9yVXVpZCA9IGV2ZW50LmRlc2NyaXB0b3JVdWlkO1xuLy8gICB2YXIgaGFuZGxlID0gZXZlbnQuaGFuZGxlO1xuXG4vLyAgIGlmICh0eXBlID09PSAnc3RhdGVDaGFuZ2UnKSB7XG4vLyAgICAgY29uc29sZS5sb2coc3RhdGUpO1xuLy8gICAgIHRoaXMuZW1pdCgnc3RhdGVDaGFuZ2UnLCBzdGF0ZSk7XG4vLyAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3Jzc2lVcGRhdGUnKSB7XG4vLyAgICAgdGhpcy5lbWl0KCdyc3NpVXBkYXRlJywgcGVyaXBoZXJhbFV1aWQsIHJzc2kpO1xuLy8gICB9IGVsc2UgaWYgKHR5cGUgPT09ICdpbmNsdWRlZFNlcnZpY2VzRGlzY292ZXInKSB7XG4vLyAgICAgdGhpcy5lbWl0KCdpbmNsdWRlZFNlcnZpY2VzRGlzY292ZXInLCBwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGluY2x1ZGVkU2VydmljZVV1aWRzKTtcbi8vICAgfSBlbHNlIGlmICh0eXBlID09PSAncmVhZCcpIHtcbi8vICAgICB0aGlzLmVtaXQoJ3JlYWQnLCBwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgZGF0YSwgaXNOb3RpZmljYXRpb24pO1xuLy8gICB9IGVsc2UgaWYgKHR5cGUgPT09ICdicm9hZGNhc3QnKSB7XG4vLyAgICAgdGhpcy5lbWl0KCdicm9hZGNhc3QnLCBwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgc3RhdGUpO1xuLy8gICB9IGVsc2UgaWYgKHR5cGUgPT09ICdub3RpZnknKSB7XG4vLyAgICAgdGhpcy5lbWl0KCdub3RpZnknLCBwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgc3RhdGUpO1xuLy8gICB9IGVsc2UgaWYgKHR5cGUgPT09ICdkZXNjcmlwdG9yc0Rpc2NvdmVyJykge1xuLy8gICAgIHRoaXMuZW1pdCgnZGVzY3JpcHRvcnNEaXNjb3ZlcicsIHBlcmlwaGVyYWxVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBkZXNjcmlwdG9ycyk7XG4vLyAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3ZhbHVlUmVhZCcpIHtcbi8vICAgICB0aGlzLmVtaXQoJ3ZhbHVlUmVhZCcsIHBlcmlwaGVyYWxVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBkZXNjcmlwdG9yVXVpZCwgZGF0YSk7XG4vLyAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3ZhbHVlV3JpdGUnKSB7XG4vLyAgICAgdGhpcy5lbWl0KCd2YWx1ZVdyaXRlJywgcGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIGRlc2NyaXB0b3JVdWlkKTtcbi8vICAgfSBlbHNlIGlmICh0eXBlID09PSAnaGFuZGxlUmVhZCcpIHtcbi8vICAgICB0aGlzLmVtaXQoJ2hhbmRsZVJlYWQnLCBoYW5kbGUsIGRhdGEpO1xuLy8gICB9IGVsc2UgaWYgKHR5cGUgPT09ICdoYW5kbGVXcml0ZScpIHtcbi8vICAgICB0aGlzLmVtaXQoJ2hhbmRsZVdyaXRlJywgaGFuZGxlKTtcbi8vICAgfVxuLy8gfTtcblxuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5zdGFydFNjYW5uaW5nID0gZnVuY3Rpb24oc2VydmljZVV1aWRzLCBhbGxvd0R1cGxpY2F0ZXMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBjb25zb2xlLmxvZygnc3RhcnRTY2FubmluZycsIHNlcnZpY2VVdWlkcywgYWxsb3dEdXBsaWNhdGVzKTtcbiAgYmxlLnN0YXJ0U2NhbihmdW5jdGlvbihkYXRhKXtcbiAgICBjb25zb2xlLmxvZygnc2NhbicsIGRhdGEpO1xuICAgIGlmKGRhdGEuc3RhdHVzID09PSAnc2NhblJlc3VsdCcpe1xuICAgICAgc2VsZi5fcGVyaXBoZXJhbHNbZGF0YS5hZGRyZXNzXSA9IGRhdGE7XG4gICAgICBzZWxmLmVtaXQoJ2Rpc2NvdmVyJywgZGF0YS5hZGRyZXNzLCB7bG9jYWxOYW1lOmRhdGEubmFtZSwgc2VydmljZVV1aWRzOiBzZXJ2aWNlVXVpZHN9LCBkYXRhLnJzc2kpO1xuICAgIH1cbiAgfSwgZnVuY3Rpb24oZXJyKXtcbiAgICBjb25zb2xlLmxvZygnY2FudCBzY2FuIGJsZScsIGVycik7XG4gIH0sIHtzZXJ2aWNlVXVpZHM6IHNlcnZpY2VVdWlkc30pO1xuXG4gIHRoaXMuZW1pdCgnc2NhblN0YXJ0Jyk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5zdG9wU2Nhbm5pbmcgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGJsZS5zdG9wU2NhbihmdW5jdGlvbihkYXRhKXtcbiAgICBjb25zb2xlLmxvZygnc3RvcCBzY2FuJywgZGF0YSk7XG4gIH0sIGZ1bmN0aW9uKGVycil7XG4gICAgY29uc29sZS5sb2coJ2NhbnQgc3RvcCBzY2FuJywgZXJyKTtcbiAgfSk7XG5cbiAgdGhpcy5lbWl0KCdzY2FuU3RvcCcpO1xufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKGRldmljZVV1aWQpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBmdW5jdGlvbiBvbkNvbm5lY3QoZGF0YSl7XG4gIFx0Y29uc29sZS5sb2coJ2Nvbm5lY3QnLCBkYXRhKTtcbiAgICBpZihkYXRhLnN0YXR1cyA9PT0gJ2Nvbm5lY3RlZCcpe1xuICAgICAgc2VsZi5lbWl0KCdjb25uZWN0JywgZGV2aWNlVXVpZCk7XG4gICAgfVxuICB9XG4gIGJsZS5jb25uZWN0KG9uQ29ubmVjdCwgZnVuY3Rpb24oZXJyKXtcbiAgICBibGUucmVjb25uZWN0KG9uQ29ubmVjdCwgZnVuY3Rpb24oKXtcblx0ICAgIGNvbnNvbGUubG9nKCdjYW50IGNvbm5lY3QnLCBlcnIpO1xuICAgIH0pO1xuICB9LCB7YWRkcmVzczogZGV2aWNlVXVpZH0pO1xufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUuZGlzY29ubmVjdCA9IGZ1bmN0aW9uKGRldmljZVV1aWQpIHtcbiAgYmxlLmRpc2Nvbm5lY3QoZnVuY3Rpb24oZGF0YSl7XG4gICAgY29uc29sZS5sb2coJ2Rpc2Nvbm5lY3QnLCBkYXRhKTtcbiAgfSwgZnVuY3Rpb24oZXJyKXtcbiAgICBjb25zb2xlLmxvZygnY2FudCBkaXNjb25uZWN0JywgZXJyKTtcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS51cGRhdGVSc3NpID0gZnVuY3Rpb24oZGV2aWNlVXVpZCkge1xuICAvL1RPRE9cbiAgY29uc29sZS5sb2coJ3VwZGF0ZVJzc2knLCBkZXZpY2VVdWlkKTtcbn07XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLmRpc2NvdmVyU2VydmljZXMgPSBmdW5jdGlvbihkZXZpY2VVdWlkLCB1dWlkcykge1xuXG4gIHZhciBzZWxmID0gdGhpcztcblxuICBpZihzZWxmLnBsYXRmb3JtICYmIHNlbGYucGxhdGZvcm0gPT09ICdpT1MnKXtcbiAgICAvL0lPUyBvbmx5IDooXG4gICAgYmxlLnNlcnZpY2VzKGZ1bmN0aW9uKGRhdGEpe1xuICAgICAgY29uc29sZS5sb2coJ2Rpc2NvdmVyU2VydmljZXMgYmxlLnNlcnZpY2VzJywgZGF0YSk7XG4gICAgICBzZWxmLmVtaXQoJ3NlcnZpY2VzRGlzY292ZXInLCBkZXZpY2VVdWlkLCBkYXRhLnNlcnZpY2VVdWlkcyk7XG4gICAgfSwgZnVuY3Rpb24oZXJyKXtcbiAgICAgIGNvbnNvbGUubG9nKCdjYW50IGRpc2NvdmVyU2VydmljZXMgYmxlLnNlcnZpY2VzJywgZXJyKTtcbiAgICB9LCB7J3NlcnZpY2VVdWlkcyc6dXVpZHN9KTtcbiAgfWVsc2V7XG4gICAgLy9BbmRyb2lkIG9ubHkgOihcbiAgICBibGUuZGlzY292ZXIoZnVuY3Rpb24oZGF0YSl7XG4gICAgICBjb25zb2xlLmxvZygnZGlzY292ZXJTZXJ2aWNlcyBibGUuZGlzY292ZXInLCBkYXRhKTtcbiAgICAgIHZhciBtYXRjaGluZ1NlcnZpY2VzID0gW107XG4gICAgICBpZighQXJyYXkuaXNBcnJheSh1dWlkcykpe1xuICAgICAgICB1dWlkcyA9IFt1dWlkc107XG4gICAgICB9XG4gICAgICB1dWlkcy5mb3JFYWNoKGZ1bmN0aW9uKHV1aWQpe1xuICAgICAgICBkYXRhLnNlcnZpY2VzLmZvckVhY2goZnVuY3Rpb24oc2VydmljZSl7XG4gICAgICAgICAgY29uc29sZS5sb2coJ2NoZWNraW5nJywgdXVpZCwgJ2FnYWluc3QnLCBzZXJ2aWNlLnNlcnZpY2VVdWlkKTtcbiAgICAgICAgICBpZihlcXVhbFV1aWRzKHV1aWQsIHNlcnZpY2Uuc2VydmljZVV1aWQpKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdtYXRjaCBmb3VuZCcsIHV1aWQpO1xuICAgICAgICAgICAgbWF0Y2hpbmdTZXJ2aWNlcy5wdXNoKHNlcnZpY2Uuc2VydmljZVV1aWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgc2VsZi5lbWl0KCdzZXJ2aWNlc0Rpc2NvdmVyJywgZGV2aWNlVXVpZCwgbWF0Y2hpbmdTZXJ2aWNlcyk7XG4gICAgfSwgZnVuY3Rpb24oZXJyKXtcbiAgICAgIGNvbnNvbGUubG9nKCdjYW50IGRpc2NvdmVyU2VydmljZXMgYmxlLmRpc2NvdmVyJywgZXJyKTtcbiAgICB9KTtcbiAgfVxuXG5cbn07XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLmRpc2NvdmVySW5jbHVkZWRTZXJ2aWNlcyA9IGZ1bmN0aW9uKGRldmljZVV1aWQsIHNlcnZpY2VVdWlkLCBzZXJ2aWNlVXVpZHMpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1tkZXZpY2VVdWlkXTtcblxuICAvL1RPRE9cblxuICAvLyB0aGlzLl9zZW5kQ29tbWFuZCh7XG4gIC8vICAgYWN0aW9uOiAnZGlzY292ZXJJbmNsdWRlZFNlcnZpY2VzJyxcbiAgLy8gICBwZXJpcGhlcmFsVXVpZDogcGVyaXBoZXJhbC51dWlkLFxuICAvLyAgIHNlcnZpY2VVdWlkOiBzZXJ2aWNlVXVpZCxcbiAgLy8gICBzZXJ2aWNlVXVpZHM6IHNlcnZpY2VVdWlkc1xuICAvLyB9KTtcbn07XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLmRpc2NvdmVyQ2hhcmFjdGVyaXN0aWNzID0gZnVuY3Rpb24oZGV2aWNlVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZHMpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1tkZXZpY2VVdWlkXTtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGNvbnNvbGUubG9nKCdkaXNjb3ZlckNoYXJhY3RlcmlzdGljcycsIGRldmljZVV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWRzKTtcblxuICBpZihzZWxmLnBsYXRmb3JtICYmIHNlbGYucGxhdGZvcm0gPT09ICdpT1MnKXtcbiAgICAvL0lPUyBvbmx5IDooXG4gICAgYmxlLmNoYXJhY3RlcmlzdGljcyhmdW5jdGlvbihkYXRhKXtcbiAgICAgIGNvbnNvbGUubG9nKCdkaXNjb3ZlckNoYXJhY3RlcmlzdGljcyBibGUuY2hhcmFjdGVyaXN0aWNzJywgZGF0YSk7XG4gICAgICB2YXIgY2hhcmFjdGVyaXN0aWNzID0gW107XG4gICAgICAvLyBMYXRlc3QgdmVyc2lvbiBvZiBibGUgcmV0dXJucyBkaWZmZXJlbnQgc3RhdHVzXG4gICAgICBpZihkYXRhLnN0YXR1cyAmJiBbJ2Rpc2NvdmVyZWRDaGFyYWN0ZXJpc3RpY3MnLCAnZGlzY292ZXJDaGFyYWN0ZXJpc3RpY3MnXS5pbmRleE9mKGRhdGEuc3RhdHVzKSA+IC0xKXtcbiAgICAgICAgY2hhcmFjdGVyaXN0aWNzID0gZGF0YS5jaGFyYWN0ZXJpc3RpY3MgfHwgZGF0YS5jaGFyYWN0ZXJpc3RpY1V1aWRzIHx8IFtdO1xuICAgICAgfWVsc2V7XG4gICAgICAgIGNvbnNvbGUubG9nKCdJbmNvcnJlY3QgcmVzdWx0cyByZXR1cm5lZCBmcm9tIGRpc2NvdmVyQ2hhcmFjdGVyaXN0aWNzJyk7XG4gICAgICAgIGNoYXJhY3RlcmlzdGljcyA9IGNoYXJhY3RlcmlzdGljVXVpZHMgfHwgW107XG4gICAgICB9XG4gICAgICB2YXIgY2hhcmFjdGVyaXN0T2JqZWN0cyA9IFtdO1xuICAgICAgY2hhcmFjdGVyaXN0aWNzLmZvckVhY2goZnVuY3Rpb24oY2hhcmFjdGVyaXN0aWMpe1xuICAgICAgXHR2YXIgdXVpZDtcbiAgICAgIFx0aWYodHlwZW9mIGNoYXJhY3RlcmlzdGljID09PSAnc3RyaW5nJyl7XG4gICAgICBcdFx0dXVpZCA9IGNoYXJhY3RlcmlzdGljO1xuICAgICAgXHR9ZWxzZXtcbiAgICAgIFx0XHR1dWlkID0gY2hhcmFjdGVyaXN0aWMuY2hhcmFjdGVyaXN0aWNVdWlkO1xuICAgICAgXHR9XG4gICAgICAgIGNoYXJhY3RlcmlzdE9iamVjdHMucHVzaCh7IHV1aWQ6IHV1aWQgIH0pO1xuICAgICAgfSk7XG4gICAgICBzZWxmLmVtaXQoJ2NoYXJhY3RlcmlzdGljc0Rpc2NvdmVyJywgZGV2aWNlVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdE9iamVjdHMpO1xuICAgIH0sIGZ1bmN0aW9uKGVycil7XG4gICAgICBjb25zb2xlLmxvZygnY2FudCBkaXNjb3ZlckNoYXJhY3RlcmlzdGljcyBibGUuY2hhcmFjdGVyaXN0aWNzJywgZXJyKTtcbiAgICB9LCB7J3NlcnZpY2VVdWlkJzpzZXJ2aWNlVXVpZCwnY2hhcmFjdGVyaXN0aWNVdWlkcyc6Y2hhcmFjdGVyaXN0aWNVdWlkc30pO1xuICB9ZWxzZXtcbiAgICAvL0FuZHJvaWQgaGFjayA6KFxuICAgIGJsZS5kaXNjb3ZlcihmdW5jdGlvbihkYXRhKXtcbiAgICAgIGNvbnNvbGUubG9nKCdkaXNjb3ZlckNoYXJhY3RlcmlzdGljcyBibGUuZGlzY292ZXInLCBkYXRhKTtcbiAgICAgIHZhciBtYXRjaGluZ0NoYXJzID0gW107XG5cbiAgICAgIGRhdGEuc2VydmljZXMuZm9yRWFjaChmdW5jdGlvbihzZXJ2aWNlKXtcbiAgICAgICAgaWYoZXF1YWxVdWlkcyhzZXJ2aWNlVXVpZCwgc2VydmljZS5zZXJ2aWNlVXVpZCkpe1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdtYXRjaGVkIHNlcnZpY2UgaW4gZGlzY292ZXJDaGFyYWN0ZXJpc3RpY3MnLCBzZXJ2aWNlVXVpZCk7XG4gICAgICAgICAgaWYoIUFycmF5LmlzQXJyYXkoY2hhcmFjdGVyaXN0aWNVdWlkcykpe1xuICAgICAgICAgICAgY2hhcmFjdGVyaXN0aWNVdWlkcyA9IFtjaGFyYWN0ZXJpc3RpY1V1aWRzXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc29sZS5sb2coJ2NoZWNraW5nOiAnICsgSlNPTi5zdHJpbmdpZnkoY2hhcmFjdGVyaXN0aWNVdWlkcykgKyAnIGFnYWluc3Q6ICcgKyAgSlNPTi5zdHJpbmdpZnkoc2VydmljZS5jaGFyYWN0ZXJpc3RpY3MpKTtcbiAgICAgICAgICBjaGFyYWN0ZXJpc3RpY1V1aWRzLmZvckVhY2goZnVuY3Rpb24odXVpZCl7XG4gICAgICAgICAgICBzZXJ2aWNlLmNoYXJhY3RlcmlzdGljcy5mb3JFYWNoKGZ1bmN0aW9uKGNoYXJhY3RlcmlzdGljKXtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2NoZWNraW5nIGNoYXJhY3RlcmlzdGljQXNzaWduZWROdW1iZXInICsgY2hhcmFjdGVyaXN0aWMuY2hhcmFjdGVyaXN0aWNVdWlkLnRvTG93ZXJDYXNlKCkgKyAnIDo6ICcgKyB1dWlkKTtcbiAgICAgICAgICAgICAgaWYoZXF1YWxVdWlkcyhjaGFyYWN0ZXJpc3RpYy5jaGFyYWN0ZXJpc3RpY1V1aWQsIHV1aWQpKXtcbiAgICAgICAgICAgICAgICBtYXRjaGluZ0NoYXJzLnB1c2goe3V1aWQ6IGNoYXJhY3RlcmlzdGljLmNoYXJhY3RlcmlzdGljVXVpZH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgY29uc29sZS5sb2coJ21hdGNoaW5nQ2hhcnM6ICcgKyBKU09OLnN0cmluZ2lmeShtYXRjaGluZ0NoYXJzKSk7XG4gICAgICBzZWxmLmVtaXQoJ2NoYXJhY3RlcmlzdGljc0Rpc2NvdmVyJywgZGV2aWNlVXVpZCwgc2VydmljZVV1aWQsIG1hdGNoaW5nQ2hhcnMpO1xuXG4gICAgfSwgZnVuY3Rpb24oZXJyKXtcbiAgICAgIGNvbnNvbGUubG9nKCdjYW50IGRpc2NvdmVyQ2hhcmFjdGVyaXN0aWNzIGJsZS5kaXNjb3ZlcicsIGVycik7XG4gICAgfSk7XG4gIH1cblxufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUucmVhZCA9IGZ1bmN0aW9uKGRldmljZVV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1tkZXZpY2VVdWlkXTtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGNvbnNvbGUubG9nKCdyZWFkJywgZGV2aWNlVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCk7XG5cbiAgYmxlLnJlYWQoZnVuY3Rpb24ocmVzcCl7XG4gICAgY29uc29sZS5sb2coJ3JlYWQgYmxlLnJlYWQnLCByZXNwKTtcbiAgICBzZWxmLmVtaXQoJ3JlYWQnLCBkZXZpY2VVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBhdG9iKHJlc3AudmFsdWUpLCBmYWxzZSk7XG4gIH0sIGZ1bmN0aW9uKGVycil7XG4gICAgY29uc29sZS5sb2coJ2NhbnQgcmVhZCBibGUucmVhZCcsIGVycik7XG4gIH0sIHtcInNlcnZpY2VVdWlkXCI6c2VydmljZVV1aWQsXCJjaGFyYWN0ZXJpc3RpY1V1aWRcIjpjaGFyYWN0ZXJpc3RpY1V1aWR9KTtcblxufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbihkZXZpY2VVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBkYXRhLCB3aXRob3V0UmVzcG9uc2UpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1tkZXZpY2VVdWlkXTtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGNvbnNvbGUubG9nKCd3cml0ZScsIGRldmljZVV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIGRhdGEsIHdpdGhvdXRSZXNwb25zZSk7XG5cbiAgYmxlLndyaXRlKGZ1bmN0aW9uKHJlc3Ape1xuICAgIGNvbnNvbGUubG9nKCd3cml0ZSBibGUud3JpdGUnLCByZXNwKTtcbiAgICBpZighd2l0aG91dFJlc3BvbnNlKXtcbiAgICAgIHNlbGYuZW1pdCgnd3JpdGUnLCBkZXZpY2VVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkKTtcbiAgICB9XG4gIH0sIGZ1bmN0aW9uKGVycil7XG4gICAgY29uc29sZS5sb2coJ2NhbnQgd3JpdGUgYmxlLndyaXRlJywgZXJyKTtcbiAgfSwge1widmFsdWVcIjpieXRlc1RvRW5jb2RlZFN0cmluZyhkYXRhKSxcInNlcnZpY2VVdWlkXCI6c2VydmljZVV1aWQsXCJjaGFyYWN0ZXJpc3RpY1V1aWRcIjpjaGFyYWN0ZXJpc3RpY1V1aWR9KTtcblxufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUuYnJvYWRjYXN0ID0gZnVuY3Rpb24oZGV2aWNlVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgYnJvYWRjYXN0KSB7XG4gIHZhciBwZXJpcGhlcmFsID0gdGhpcy5fcGVyaXBoZXJhbHNbZGV2aWNlVXVpZF07XG5cbiAgLy8gVE9ETyA/IGRvbid0IHNlZSB0aGlzIGZ1bmN0aW9uYWxpdHkgaW4gdGhlIHBob25lZ2FwIHBsdWdpblxuXG4gIC8vIHRoaXMuX3NlbmRDb21tYW5kKHtcbiAgLy8gICBhY3Rpb246ICdicm9hZGNhc3QnLFxuICAvLyAgIHBlcmlwaGVyYWxVdWlkOiBwZXJpcGhlcmFsLnV1aWQsXG4gIC8vICAgc2VydmljZVV1aWQ6IHNlcnZpY2VVdWlkLFxuICAvLyAgIGNoYXJhY3RlcmlzdGljVXVpZDogY2hhcmFjdGVyaXN0aWNVdWlkLFxuICAvLyAgIGJyb2FkY2FzdDogYnJvYWRjYXN0XG4gIC8vIH0pO1xufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUubm90aWZ5ID0gZnVuY3Rpb24oZGV2aWNlVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgbm90aWZ5KSB7XG4gIHZhciBwZXJpcGhlcmFsID0gdGhpcy5fcGVyaXBoZXJhbHNbZGV2aWNlVXVpZF07XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBjb25zb2xlLmxvZygnbm90aWZ5JywgZGV2aWNlVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgbm90aWZ5KTtcbiAgYmxlLnN1YnNjcmliZShmdW5jdGlvbihkYXRhKXtcbiAgICBjb25zb2xlLmxvZygnc3Vic2NyaWJlJywgZGF0YSk7XG4gICAgaWYoZGF0YS5zdGF0dXMgPT09ICdzdWJzY3JpYmVkUmVzdWx0Jyl7XG4gICAgICBzZWxmLmVtaXQoJ25vdGlmeScsIGRldmljZVV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIGJsZS5lbmNvZGVkU3RyaW5nVG9CeXRlcyhkYXRhLnZhbHVlKSk7XG4gICAgICBzZWxmLmVtaXQoJ3JlYWQnLCBkZXZpY2VVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBibGUuZW5jb2RlZFN0cmluZ1RvQnl0ZXMoZGF0YS52YWx1ZSksIHRydWUpO1xuICAgIH1cbiAgfSwgZnVuY3Rpb24oZXJyKXtcbiAgICBjb25zb2xlLmxvZygnY2FudCBub3RpZnknLCBlcnIpO1xuICB9LCB7XCJzZXJ2aWNlVXVpZFwiOnNlcnZpY2VVdWlkLFwiY2hhcmFjdGVyaXN0aWNVdWlkXCI6Y2hhcmFjdGVyaXN0aWNVdWlkLFwiaXNOb3RpZmljYXRpb25cIjp0cnVlfSk7XG5cbn07XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLmRpc2NvdmVyRGVzY3JpcHRvcnMgPSBmdW5jdGlvbihkZXZpY2VVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkKSB7XG4gIHZhciBwZXJpcGhlcmFsID0gdGhpcy5fcGVyaXBoZXJhbHNbZGV2aWNlVXVpZF07XG5cbiAgLy8gdGhpcy5fc2VuZENvbW1hbmQoe1xuICAvLyAgIGFjdGlvbjogJ2Rpc2NvdmVyRGVzY3JpcHRvcnMnLFxuICAvLyAgIHBlcmlwaGVyYWxVdWlkOiBwZXJpcGhlcmFsLnV1aWQsXG4gIC8vICAgc2VydmljZVV1aWQ6IHNlcnZpY2VVdWlkLFxuICAvLyAgIGNoYXJhY3RlcmlzdGljVXVpZDogY2hhcmFjdGVyaXN0aWNVdWlkXG4gIC8vIH0pO1xufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUucmVhZFZhbHVlID0gZnVuY3Rpb24oZGV2aWNlVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgZGVzY3JpcHRvclV1aWQpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1tkZXZpY2VVdWlkXTtcblxuICAvLyB0aGlzLl9zZW5kQ29tbWFuZCh7XG4gIC8vICAgYWN0aW9uOiAncmVhZFZhbHVlJyxcbiAgLy8gICBwZXJpcGhlcmFsVXVpZDogcGVyaXBoZXJhbC51dWlkLFxuICAvLyAgIHNlcnZpY2VVdWlkOiBzZXJ2aWNlVXVpZCxcbiAgLy8gICBjaGFyYWN0ZXJpc3RpY1V1aWQ6IGNoYXJhY3RlcmlzdGljVXVpZCxcbiAgLy8gICBkZXNjcmlwdG9yVXVpZDogZGVzY3JpcHRvclV1aWRcbiAgLy8gfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS53cml0ZVZhbHVlID0gZnVuY3Rpb24oZGV2aWNlVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgZGVzY3JpcHRvclV1aWQsIGRhdGEpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1tkZXZpY2VVdWlkXTtcblxuICAvLyB0aGlzLl9zZW5kQ29tbWFuZCh7XG4gIC8vICAgYWN0aW9uOiAnd3JpdGVWYWx1ZScsXG4gIC8vICAgcGVyaXBoZXJhbFV1aWQ6IHBlcmlwaGVyYWwudXVpZCxcbiAgLy8gICBzZXJ2aWNlVXVpZDogc2VydmljZVV1aWQsXG4gIC8vICAgY2hhcmFjdGVyaXN0aWNVdWlkOiBjaGFyYWN0ZXJpc3RpY1V1aWQsXG4gIC8vICAgZGVzY3JpcHRvclV1aWQ6IGRlc2NyaXB0b3JVdWlkLFxuICAvLyAgIGRhdGE6IGRhdGEudG9TdHJpbmcoJ2hleCcpXG4gIC8vIH0pO1xufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUucmVhZEhhbmRsZSA9IGZ1bmN0aW9uKGRldmljZVV1aWQsIGhhbmRsZSkge1xuICB2YXIgcGVyaXBoZXJhbCA9IHRoaXMuX3BlcmlwaGVyYWxzW2RldmljZVV1aWRdO1xuXG4gIC8vIHRoaXMuX3NlbmRDb21tYW5kKHtcbiAgLy8gICBhY3Rpb246ICdyZWFkSGFuZGxlJyxcbiAgLy8gICBwZXJpcGhlcmFsVXVpZDogcGVyaXBoZXJhbC51dWlkLFxuICAvLyAgIGhhbmRsZTogaGFuZGxlXG4gIC8vIH0pO1xufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUud3JpdGVIYW5kbGUgPSBmdW5jdGlvbihkZXZpY2VVdWlkLCBoYW5kbGUsIGRhdGEsIHdpdGhvdXRSZXNwb25zZSkge1xuICB2YXIgcGVyaXBoZXJhbCA9IHRoaXMuX3BlcmlwaGVyYWxzW2RldmljZVV1aWRdO1xuXG4gIC8vIHRoaXMuX3NlbmRDb21tYW5kKHtcbiAgLy8gICBhY3Rpb246ICdyZWFkSGFuZGxlJyxcbiAgLy8gICBwZXJpcGhlcmFsVXVpZDogcGVyaXBoZXJhbC51dWlkLFxuICAvLyAgIGhhbmRsZTogaGFuZGxlLFxuICAvLyAgIGRhdGE6IGRhdGEudG9TdHJpbmcoJ2hleCcpLFxuICAvLyAgIHdpdGhvdXRSZXNwb25zZTogd2l0aG91dFJlc3BvbnNlXG4gIC8vIH0pO1xufTtcblxudmFyIG5vYmxlQmluZGluZ3MgPSBuZXcgTm9ibGVCaW5kaW5ncygpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5vYmxlQmluZGluZ3M7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiSXJYVXN1XCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbm9kZV9tb2R1bGVzL25vYmxlL2xpYi9icm93c2VyL3Bob25lZ2FwL2JpbmRpbmdzLmpzXCIsXCIvbm9kZV9tb2R1bGVzL25vYmxlL2xpYi9icm93c2VyL3Bob25lZ2FwXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIGV2ZW50cyA9IHJlcXVpcmUoJ2V2ZW50cycpO1xudmFyIHV0aWwgPSByZXF1aXJlKCd1dGlsJyk7XG5cbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJykoJ2JpbmRpbmdzJyk7XG52YXIgV2ViU29ja2V0ID0gcmVxdWlyZSgnd3MnKTtcblxudmFyIE5vYmxlQmluZGluZ3MgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHBvcnQgPSAweEIxZTtcbiAgdGhpcy5fd3MgPSBuZXcgV2ViU29ja2V0KCd3czovL2xvY2FsaG9zdDonICsgcG9ydCk7XG5cbiAgdGhpcy5fc3RhcnRTY2FuQ29tbWFuZCA9IG51bGw7XG4gIHRoaXMuX3BlcmlwaGVyYWxzID0ge307XG5cbiAgdGhpcy5vbignbWVzc2FnZScsIHRoaXMuX29uTWVzc2FnZS5iaW5kKHRoaXMpKTtcblxuICBpZiAoIXRoaXMuX3dzLm9uKSB7XG4gICAgdGhpcy5fd3Mub24gPSB0aGlzLl93cy5hZGRFdmVudExpc3RlbmVyO1xuICB9XG5cbiAgdGhpcy5fd3Mub24oJ29wZW4nLCB0aGlzLl9vbk9wZW4uYmluZCh0aGlzKSk7XG4gIHRoaXMuX3dzLm9uKCdjbG9zZScsIHRoaXMuX29uQ2xvc2UuYmluZCh0aGlzKSk7XG5cbiAgdmFyIF90aGlzID0gdGhpcztcbiAgdGhpcy5fd3Mub24oJ21lc3NhZ2UnLCBmdW5jdGlvbihldmVudCkge1xuICAgIHZhciBkYXRhID0gKHByb2Nlc3MudGl0bGUgPT09ICdicm93c2VyJykgPyBldmVudC5kYXRhIDogZXZlbnQ7XG4gICAgXG4gICAgX3RoaXMuZW1pdCgnbWVzc2FnZScsIEpTT04ucGFyc2UoZGF0YSkpO1xuICB9KTtcbn07XG5cbnV0aWwuaW5oZXJpdHMoTm9ibGVCaW5kaW5ncywgZXZlbnRzLkV2ZW50RW1pdHRlcik7XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLl9vbk9wZW4gPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJ29uIC0+IG9wZW4nKTtcbn07XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLl9vbkNsb3NlID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUubG9nKCdvbiAtPiBjbG9zZScpO1xuXG4gIHRoaXMuZW1pdCgnc3RhdGVDaGFuZ2UnLCAncG93ZXJlZE9mZicpO1xufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUuX29uTWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gIHZhciB0eXBlID0gZXZlbnQudHlwZTtcbiAgdmFyIHBlcmlwaGVyYWxVdWlkID0gZXZlbnQucGVyaXBoZXJhbFV1aWQ7XG4gIHZhciBhZHZlcnRpc2VtZW50ID0gZXZlbnQuYWR2ZXJ0aXNlbWVudDtcbiAgdmFyIHJzc2kgPSBldmVudC5yc3NpO1xuICB2YXIgc2VydmljZVV1aWRzID0gZXZlbnQuc2VydmljZVV1aWRzO1xuICB2YXIgc2VydmljZVV1aWQgPSBldmVudC5zZXJ2aWNlVXVpZDtcbiAgdmFyIGluY2x1ZGVkU2VydmljZVV1aWRzID0gZXZlbnQuaW5jbHVkZWRTZXJ2aWNlVXVpZHM7XG4gIHZhciBjaGFyYWN0ZXJpc3RpY3MgPSBldmVudC5jaGFyYWN0ZXJpc3RpY3M7XG4gIHZhciBjaGFyYWN0ZXJpc3RpY1V1aWQgPSBldmVudC5jaGFyYWN0ZXJpc3RpY1V1aWQ7XG4gIHZhciBkYXRhID0gZXZlbnQuZGF0YSA/IG5ldyBCdWZmZXIoZXZlbnQuZGF0YSwgJ2hleCcpIDogbnVsbDtcbiAgdmFyIGlzTm90aWZpY2F0aW9uID0gZXZlbnQuaXNOb3RpZmljYXRpb247XG4gIHZhciBzdGF0ZSA9IGV2ZW50LnN0YXRlO1xuICB2YXIgZGVzY3JpcHRvcnMgPSBldmVudC5kZXNjcmlwdG9ycztcbiAgdmFyIGRlc2NyaXB0b3JVdWlkID0gZXZlbnQuZGVzY3JpcHRvclV1aWQ7XG4gIHZhciBoYW5kbGUgPSBldmVudC5oYW5kbGU7XG5cbiAgaWYgKHR5cGUgPT09ICdzdGF0ZUNoYW5nZScpIHtcbiAgICBjb25zb2xlLmxvZyhzdGF0ZSk7XG4gICAgdGhpcy5lbWl0KCdzdGF0ZUNoYW5nZScsIHN0YXRlKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnZGlzY292ZXInKSB7XG4gICAgYWR2ZXJ0aXNlbWVudCA9IHtcbiAgICAgIGxvY2FsTmFtZTogYWR2ZXJ0aXNlbWVudC5sb2NhbE5hbWUsXG4gICAgICB0eFBvd2VyTGV2ZWw6IGFkdmVydGlzZW1lbnQudHhQb3dlckxldmVsLFxuICAgICAgc2VydmljZVV1aWRzOiBhZHZlcnRpc2VtZW50LnNlcnZpY2VVdWlkcyxcbiAgICAgIG1hbnVmYWN0dXJlckRhdGE6IChhZHZlcnRpc2VtZW50Lm1hbnVmYWN0dXJlckRhdGEgPyBuZXcgQnVmZmVyKGFkdmVydGlzZW1lbnQubWFudWZhY3R1cmVyRGF0YSwgJ2hleCcpIDogbnVsbCksXG4gICAgICBzZXJ2aWNlRGF0YTogKGFkdmVydGlzZW1lbnQuc2VydmljZURhdGEgPyBuZXcgQnVmZmVyKGFkdmVydGlzZW1lbnQuc2VydmljZURhdGEsICdoZXgnKSA6IG51bGwpXG4gICAgfTtcblxuICAgIHRoaXMuX3BlcmlwaGVyYWxzW3BlcmlwaGVyYWxVdWlkXSA9IHtcbiAgICAgIHV1aWQ6IHBlcmlwaGVyYWxVdWlkLFxuICAgICAgYWR2ZXJ0aXNlbWVudDogYWR2ZXJ0aXNlbWVudCxcbiAgICAgIHJzc2k6IHJzc2lcbiAgICB9O1xuXG4gICAgdGhpcy5lbWl0KCdkaXNjb3ZlcicsIHBlcmlwaGVyYWxVdWlkLCBhZHZlcnRpc2VtZW50LCByc3NpKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnY29ubmVjdCcpIHtcbiAgICB0aGlzLmVtaXQoJ2Nvbm5lY3QnLCBwZXJpcGhlcmFsVXVpZCk7XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2Rpc2Nvbm5lY3QnKSB7XG4gICAgdGhpcy5lbWl0KCdkaXNjb25uZWN0JywgcGVyaXBoZXJhbFV1aWQpO1xuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdyc3NpVXBkYXRlJykge1xuICAgIHRoaXMuZW1pdCgncnNzaVVwZGF0ZScsIHBlcmlwaGVyYWxVdWlkLCByc3NpKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnc2VydmljZXNEaXNjb3ZlcicpIHtcbiAgICB0aGlzLmVtaXQoJ3NlcnZpY2VzRGlzY292ZXInLCBwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWRzKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnaW5jbHVkZWRTZXJ2aWNlc0Rpc2NvdmVyJykge1xuICAgIHRoaXMuZW1pdCgnaW5jbHVkZWRTZXJ2aWNlc0Rpc2NvdmVyJywgcGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBpbmNsdWRlZFNlcnZpY2VVdWlkcyk7XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2NoYXJhY3RlcmlzdGljc0Rpc2NvdmVyJykge1xuICAgIHRoaXMuZW1pdCgnY2hhcmFjdGVyaXN0aWNzRGlzY292ZXInLCBwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljcyk7XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3JlYWQnKSB7XG4gICAgdGhpcy5lbWl0KCdyZWFkJywgcGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIGRhdGEsIGlzTm90aWZpY2F0aW9uKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnd3JpdGUnKSB7XG4gICAgdGhpcy5lbWl0KCd3cml0ZScsIHBlcmlwaGVyYWxVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnYnJvYWRjYXN0Jykge1xuICAgIHRoaXMuZW1pdCgnYnJvYWRjYXN0JywgcGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIHN0YXRlKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbm90aWZ5Jykge1xuICAgIHRoaXMuZW1pdCgnbm90aWZ5JywgcGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIHN0YXRlKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnZGVzY3JpcHRvcnNEaXNjb3ZlcicpIHtcbiAgICB0aGlzLmVtaXQoJ2Rlc2NyaXB0b3JzRGlzY292ZXInLCBwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgZGVzY3JpcHRvcnMpO1xuICB9IGVsc2UgaWYgKHR5cGUgPT09ICd2YWx1ZVJlYWQnKSB7XG4gICAgdGhpcy5lbWl0KCd2YWx1ZVJlYWQnLCBwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgZGVzY3JpcHRvclV1aWQsIGRhdGEpO1xuICB9IGVsc2UgaWYgKHR5cGUgPT09ICd2YWx1ZVdyaXRlJykge1xuICAgIHRoaXMuZW1pdCgndmFsdWVXcml0ZScsIHBlcmlwaGVyYWxVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBkZXNjcmlwdG9yVXVpZCk7XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2hhbmRsZVJlYWQnKSB7XG4gICAgdGhpcy5lbWl0KCdoYW5kbGVSZWFkJywgaGFuZGxlLCBkYXRhKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnaGFuZGxlV3JpdGUnKSB7XG4gICAgdGhpcy5lbWl0KCdoYW5kbGVXcml0ZScsIGhhbmRsZSk7XG4gIH1cbn07XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLl9zZW5kQ29tbWFuZCA9IGZ1bmN0aW9uKGNvbW1hbmQpIHtcbiAgdmFyIG1lc3NhZ2UgPSBKU09OLnN0cmluZ2lmeShjb21tYW5kKTtcblxuICB0aGlzLl93cy5zZW5kKG1lc3NhZ2UpO1xufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUuc3RhcnRTY2FubmluZyA9IGZ1bmN0aW9uKHNlcnZpY2VVdWlkcywgYWxsb3dEdXBsaWNhdGVzKSB7XG4gIHRoaXMuX3N0YXJ0U2NhbkNvbW1hbmQgPSB7XG4gICAgYWN0aW9uOiAnc3RhcnRTY2FubmluZycsXG4gICAgc2VydmljZVV1aWRzOiBzZXJ2aWNlVXVpZHMsXG4gICAgYWxsb3dEdXBsaWNhdGVzOiBhbGxvd0R1cGxpY2F0ZXNcbiAgfTtcbiAgdGhpcy5fc2VuZENvbW1hbmQodGhpcy5fc3RhcnRTY2FuQ29tbWFuZCk7XG5cbiAgdGhpcy5lbWl0KCdzY2FuU3RhcnQnKTtcbn07XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLnN0b3BTY2FubmluZyA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLl9zdGFydFNjYW5Db21tYW5kID0gbnVsbDtcblxuICB0aGlzLl9zZW5kQ29tbWFuZCh7XG4gICAgYWN0aW9uOiAnc3RvcFNjYW5uaW5nJ1xuICB9KTtcblxuICB0aGlzLmVtaXQoJ3NjYW5TdG9wJyk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oZGV2aWNlVXVpZCkge1xuICB2YXIgcGVyaXBoZXJhbCA9IHRoaXMuX3BlcmlwaGVyYWxzW2RldmljZVV1aWRdO1xuXG4gIHRoaXMuX3NlbmRDb21tYW5kKHtcbiAgICBhY3Rpb246ICdjb25uZWN0JyxcbiAgICBwZXJpcGhlcmFsVXVpZDogcGVyaXBoZXJhbC51dWlkXG4gIH0pO1xufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUuZGlzY29ubmVjdCA9IGZ1bmN0aW9uKGRldmljZVV1aWQpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1tkZXZpY2VVdWlkXTtcblxuICB0aGlzLl9zZW5kQ29tbWFuZCh7XG4gICAgYWN0aW9uOiAnZGlzY29ubmVjdCcsXG4gICAgcGVyaXBoZXJhbFV1aWQ6IHBlcmlwaGVyYWwudXVpZFxuICB9KTtcbn07XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLnVwZGF0ZVJzc2kgPSBmdW5jdGlvbihkZXZpY2VVdWlkKSB7XG4gIHZhciBwZXJpcGhlcmFsID0gdGhpcy5fcGVyaXBoZXJhbHNbZGV2aWNlVXVpZF07XG5cbiAgdGhpcy5fc2VuZENvbW1hbmQoe1xuICAgIGFjdGlvbjogJ3VwZGF0ZVJzc2knLFxuICAgIHBlcmlwaGVyYWxVdWlkOiBwZXJpcGhlcmFsLnV1aWRcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5kaXNjb3ZlclNlcnZpY2VzID0gZnVuY3Rpb24oZGV2aWNlVXVpZCwgdXVpZHMpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1tkZXZpY2VVdWlkXTtcblxuICB0aGlzLl9zZW5kQ29tbWFuZCh7XG4gICAgYWN0aW9uOiAnZGlzY292ZXJTZXJ2aWNlcycsXG4gICAgcGVyaXBoZXJhbFV1aWQ6IHBlcmlwaGVyYWwudXVpZCxcbiAgICB1dWlkczogdXVpZHNcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5kaXNjb3ZlckluY2x1ZGVkU2VydmljZXMgPSBmdW5jdGlvbihkZXZpY2VVdWlkLCBzZXJ2aWNlVXVpZCwgc2VydmljZVV1aWRzKSB7XG4gIHZhciBwZXJpcGhlcmFsID0gdGhpcy5fcGVyaXBoZXJhbHNbZGV2aWNlVXVpZF07XG5cbiAgdGhpcy5fc2VuZENvbW1hbmQoe1xuICAgIGFjdGlvbjogJ2Rpc2NvdmVySW5jbHVkZWRTZXJ2aWNlcycsXG4gICAgcGVyaXBoZXJhbFV1aWQ6IHBlcmlwaGVyYWwudXVpZCxcbiAgICBzZXJ2aWNlVXVpZDogc2VydmljZVV1aWQsXG4gICAgc2VydmljZVV1aWRzOiBzZXJ2aWNlVXVpZHNcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5kaXNjb3ZlckNoYXJhY3RlcmlzdGljcyA9IGZ1bmN0aW9uKGRldmljZVV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWRzKSB7XG4gIHZhciBwZXJpcGhlcmFsID0gdGhpcy5fcGVyaXBoZXJhbHNbZGV2aWNlVXVpZF07XG5cbiAgdGhpcy5fc2VuZENvbW1hbmQoe1xuICAgIGFjdGlvbjogJ2Rpc2NvdmVyQ2hhcmFjdGVyaXN0aWNzJyxcbiAgICBwZXJpcGhlcmFsVXVpZDogcGVyaXBoZXJhbC51dWlkLFxuICAgIHNlcnZpY2VVdWlkOiBzZXJ2aWNlVXVpZCxcbiAgICBjaGFyYWN0ZXJpc3RpY1V1aWRzOiBjaGFyYWN0ZXJpc3RpY1V1aWRzXG4gIH0pO1xufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUucmVhZCA9IGZ1bmN0aW9uKGRldmljZVV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1tkZXZpY2VVdWlkXTtcblxuICB0aGlzLl9zZW5kQ29tbWFuZCh7XG4gICAgYWN0aW9uOiAncmVhZCcsXG4gICAgcGVyaXBoZXJhbFV1aWQ6IHBlcmlwaGVyYWwudXVpZCxcbiAgICBzZXJ2aWNlVXVpZDogc2VydmljZVV1aWQsXG4gICAgY2hhcmFjdGVyaXN0aWNVdWlkOiBjaGFyYWN0ZXJpc3RpY1V1aWRcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uKGRldmljZVV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIGRhdGEsIHdpdGhvdXRSZXNwb25zZSkge1xuICB2YXIgcGVyaXBoZXJhbCA9IHRoaXMuX3BlcmlwaGVyYWxzW2RldmljZVV1aWRdO1xuXG4gIHRoaXMuX3NlbmRDb21tYW5kKHtcbiAgICBhY3Rpb246ICd3cml0ZScsXG4gICAgcGVyaXBoZXJhbFV1aWQ6IHBlcmlwaGVyYWwudXVpZCxcbiAgICBzZXJ2aWNlVXVpZDogc2VydmljZVV1aWQsXG4gICAgY2hhcmFjdGVyaXN0aWNVdWlkOiBjaGFyYWN0ZXJpc3RpY1V1aWQsXG4gICAgZGF0YTogZGF0YS50b1N0cmluZygnaGV4JyksXG4gICAgd2l0aG91dFJlc3BvbnNlOiB3aXRob3V0UmVzcG9uc2VcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5icm9hZGNhc3QgPSBmdW5jdGlvbihkZXZpY2VVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBicm9hZGNhc3QpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1tkZXZpY2VVdWlkXTtcblxuICB0aGlzLl9zZW5kQ29tbWFuZCh7XG4gICAgYWN0aW9uOiAnYnJvYWRjYXN0JyxcbiAgICBwZXJpcGhlcmFsVXVpZDogcGVyaXBoZXJhbC51dWlkLFxuICAgIHNlcnZpY2VVdWlkOiBzZXJ2aWNlVXVpZCxcbiAgICBjaGFyYWN0ZXJpc3RpY1V1aWQ6IGNoYXJhY3RlcmlzdGljVXVpZCxcbiAgICBicm9hZGNhc3Q6IGJyb2FkY2FzdFxuICB9KTtcbn07XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLm5vdGlmeSA9IGZ1bmN0aW9uKGRldmljZVV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIG5vdGlmeSkge1xuICB2YXIgcGVyaXBoZXJhbCA9IHRoaXMuX3BlcmlwaGVyYWxzW2RldmljZVV1aWRdO1xuXG4gIHRoaXMuX3NlbmRDb21tYW5kKHtcbiAgICBhY3Rpb246ICdub3RpZnknLFxuICAgIHBlcmlwaGVyYWxVdWlkOiBwZXJpcGhlcmFsLnV1aWQsXG4gICAgc2VydmljZVV1aWQ6IHNlcnZpY2VVdWlkLFxuICAgIGNoYXJhY3RlcmlzdGljVXVpZDogY2hhcmFjdGVyaXN0aWNVdWlkLFxuICAgIG5vdGlmeTogbm90aWZ5XG4gIH0pO1xufTtcblxuTm9ibGVCaW5kaW5ncy5wcm90b3R5cGUuZGlzY292ZXJEZXNjcmlwdG9ycyA9IGZ1bmN0aW9uKGRldmljZVV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1tkZXZpY2VVdWlkXTtcblxuICB0aGlzLl9zZW5kQ29tbWFuZCh7XG4gICAgYWN0aW9uOiAnZGlzY292ZXJEZXNjcmlwdG9ycycsXG4gICAgcGVyaXBoZXJhbFV1aWQ6IHBlcmlwaGVyYWwudXVpZCxcbiAgICBzZXJ2aWNlVXVpZDogc2VydmljZVV1aWQsXG4gICAgY2hhcmFjdGVyaXN0aWNVdWlkOiBjaGFyYWN0ZXJpc3RpY1V1aWRcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5yZWFkVmFsdWUgPSBmdW5jdGlvbihkZXZpY2VVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBkZXNjcmlwdG9yVXVpZCkge1xuICB2YXIgcGVyaXBoZXJhbCA9IHRoaXMuX3BlcmlwaGVyYWxzW2RldmljZVV1aWRdO1xuXG4gIHRoaXMuX3NlbmRDb21tYW5kKHtcbiAgICBhY3Rpb246ICdyZWFkVmFsdWUnLFxuICAgIHBlcmlwaGVyYWxVdWlkOiBwZXJpcGhlcmFsLnV1aWQsXG4gICAgc2VydmljZVV1aWQ6IHNlcnZpY2VVdWlkLFxuICAgIGNoYXJhY3RlcmlzdGljVXVpZDogY2hhcmFjdGVyaXN0aWNVdWlkLFxuICAgIGRlc2NyaXB0b3JVdWlkOiBkZXNjcmlwdG9yVXVpZFxuICB9KTtcbn07XG5cbk5vYmxlQmluZGluZ3MucHJvdG90eXBlLndyaXRlVmFsdWUgPSBmdW5jdGlvbihkZXZpY2VVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBkZXNjcmlwdG9yVXVpZCwgZGF0YSkge1xuICB2YXIgcGVyaXBoZXJhbCA9IHRoaXMuX3BlcmlwaGVyYWxzW2RldmljZVV1aWRdO1xuXG4gIHRoaXMuX3NlbmRDb21tYW5kKHtcbiAgICBhY3Rpb246ICd3cml0ZVZhbHVlJyxcbiAgICBwZXJpcGhlcmFsVXVpZDogcGVyaXBoZXJhbC51dWlkLFxuICAgIHNlcnZpY2VVdWlkOiBzZXJ2aWNlVXVpZCxcbiAgICBjaGFyYWN0ZXJpc3RpY1V1aWQ6IGNoYXJhY3RlcmlzdGljVXVpZCxcbiAgICBkZXNjcmlwdG9yVXVpZDogZGVzY3JpcHRvclV1aWQsXG4gICAgZGF0YTogZGF0YS50b1N0cmluZygnaGV4JylcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS5yZWFkSGFuZGxlID0gZnVuY3Rpb24oZGV2aWNlVXVpZCwgaGFuZGxlKSB7XG4gIHZhciBwZXJpcGhlcmFsID0gdGhpcy5fcGVyaXBoZXJhbHNbZGV2aWNlVXVpZF07XG5cbiAgdGhpcy5fc2VuZENvbW1hbmQoe1xuICAgIGFjdGlvbjogJ3JlYWRIYW5kbGUnLFxuICAgIHBlcmlwaGVyYWxVdWlkOiBwZXJpcGhlcmFsLnV1aWQsXG4gICAgaGFuZGxlOiBoYW5kbGVcbiAgfSk7XG59O1xuXG5Ob2JsZUJpbmRpbmdzLnByb3RvdHlwZS53cml0ZUhhbmRsZSA9IGZ1bmN0aW9uKGRldmljZVV1aWQsIGhhbmRsZSwgZGF0YSwgd2l0aG91dFJlc3BvbnNlKSB7XG4gIHZhciBwZXJpcGhlcmFsID0gdGhpcy5fcGVyaXBoZXJhbHNbZGV2aWNlVXVpZF07XG5cbiAgdGhpcy5fc2VuZENvbW1hbmQoe1xuICAgIGFjdGlvbjogJ3JlYWRIYW5kbGUnLFxuICAgIHBlcmlwaGVyYWxVdWlkOiBwZXJpcGhlcmFsLnV1aWQsXG4gICAgaGFuZGxlOiBoYW5kbGUsXG4gICAgZGF0YTogZGF0YS50b1N0cmluZygnaGV4JyksXG4gICAgd2l0aG91dFJlc3BvbnNlOiB3aXRob3V0UmVzcG9uc2VcbiAgfSk7XG59O1xuXG52YXIgbm9ibGVCaW5kaW5ncyA9IG5ldyBOb2JsZUJpbmRpbmdzKCk7XG5cbm1vZHVsZS5leHBvcnRzID0gbm9ibGVCaW5kaW5ncztcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJJclhVc3VcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9ub2RlX21vZHVsZXMvbm9ibGUvbGliL2Jyb3dzZXIvd2Vic29ja2V0L2JpbmRpbmdzLmpzXCIsXCIvbm9kZV9tb2R1bGVzL25vYmxlL2xpYi9icm93c2VyL3dlYnNvY2tldFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJykoJ2NoYXJhY3RlcmlzdGljJyk7XG5cbnZhciBldmVudHMgPSByZXF1aXJlKCdldmVudHMnKTtcbnZhciB1dGlsID0gcmVxdWlyZSgndXRpbCcpO1xuXG52YXIgY2hhcmFjdGVyaXN0aWNzID0gcmVxdWlyZSgnLi9jaGFyYWN0ZXJpc3RpY3MuanNvbicpO1xuXG5mdW5jdGlvbiBDaGFyYWN0ZXJpc3RpYyhub2JsZSwgcGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCB1dWlkLCBwcm9wZXJ0aWVzKSB7XG4gIHRoaXMuX25vYmxlID0gbm9ibGU7XG4gIHRoaXMuX3BlcmlwaGVyYWxVdWlkID0gcGVyaXBoZXJhbFV1aWQ7XG4gIHRoaXMuX3NlcnZpY2VVdWlkID0gc2VydmljZVV1aWQ7XG5cbiAgdGhpcy51dWlkID0gdXVpZDtcbiAgdGhpcy5uYW1lID0gbnVsbDtcbiAgdGhpcy50eXBlID0gbnVsbDtcbiAgdGhpcy5wcm9wZXJ0aWVzID0gcHJvcGVydGllcztcbiAgdGhpcy5kZXNjcmlwdG9ycyA9IG51bGw7XG5cbiAgdmFyIGNoYXJhY3RlcmlzdGljID0gY2hhcmFjdGVyaXN0aWNzW3V1aWRdO1xuICBpZiAoY2hhcmFjdGVyaXN0aWMpIHtcbiAgICB0aGlzLm5hbWUgPSBjaGFyYWN0ZXJpc3RpYy5uYW1lO1xuICAgIHRoaXMudHlwZSA9IGNoYXJhY3RlcmlzdGljLnR5cGU7XG4gIH1cbn1cblxudXRpbC5pbmhlcml0cyhDaGFyYWN0ZXJpc3RpYywgZXZlbnRzLkV2ZW50RW1pdHRlcik7XG5cbkNoYXJhY3RlcmlzdGljLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgIHV1aWQ6IHRoaXMudXVpZCxcbiAgICBuYW1lOiB0aGlzLm5hbWUsXG4gICAgdHlwZTogdGhpcy50eXBlLFxuICAgIHByb3BlcnRpZXM6IHRoaXMucHJvcGVydGllc1xuICB9KTtcbn07XG5cbkNoYXJhY3RlcmlzdGljLnByb3RvdHlwZS5yZWFkID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgaWYgKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5vbmNlKCdyZWFkJywgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgY2FsbGJhY2sobnVsbCwgZGF0YSk7XG4gICAgfSk7XG4gIH1cblxuICB0aGlzLl9ub2JsZS5yZWFkKFxuICAgIHRoaXMuX3BlcmlwaGVyYWxVdWlkLFxuICAgIHRoaXMuX3NlcnZpY2VVdWlkLFxuICAgIHRoaXMudXVpZFxuICApO1xufTtcblxuQ2hhcmFjdGVyaXN0aWMucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24oZGF0YSwgd2l0aG91dFJlc3BvbnNlLCBjYWxsYmFjaykge1xuICBpZiAocHJvY2Vzcy50aXRsZSAhPT0gJ2Jyb3dzZXInKSB7XG4gICAgaWYgKCEoZGF0YSBpbnN0YW5jZW9mIEJ1ZmZlcikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignZGF0YSBtdXN0IGJlIGEgQnVmZmVyJyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5vbmNlKCd3cml0ZScsIGZ1bmN0aW9uKCkge1xuICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgfSk7XG4gIH1cblxuICB0aGlzLl9ub2JsZS53cml0ZShcbiAgICB0aGlzLl9wZXJpcGhlcmFsVXVpZCxcbiAgICB0aGlzLl9zZXJ2aWNlVXVpZCxcbiAgICB0aGlzLnV1aWQsXG4gICAgZGF0YSxcbiAgICB3aXRob3V0UmVzcG9uc2VcbiAgKTtcbn07XG5cbkNoYXJhY3RlcmlzdGljLnByb3RvdHlwZS5icm9hZGNhc3QgPSBmdW5jdGlvbihicm9hZGNhc3QsIGNhbGxiYWNrKSB7XG4gIGlmIChjYWxsYmFjaykge1xuICAgIHRoaXMub25jZSgnYnJvYWRjYXN0JywgZnVuY3Rpb24oKSB7XG4gICAgICBjYWxsYmFjayhudWxsKTtcbiAgICB9KTtcbiAgfVxuXG4gIHRoaXMuX25vYmxlLmJyb2FkY2FzdChcbiAgICB0aGlzLl9wZXJpcGhlcmFsVXVpZCxcbiAgICB0aGlzLl9zZXJ2aWNlVXVpZCxcbiAgICB0aGlzLnV1aWQsXG4gICAgYnJvYWRjYXN0XG4gICk7XG59O1xuXG5DaGFyYWN0ZXJpc3RpYy5wcm90b3R5cGUubm90aWZ5ID0gZnVuY3Rpb24obm90aWZ5LCBjYWxsYmFjaykge1xuICBpZiAoY2FsbGJhY2spIHtcbiAgICB0aGlzLm9uY2UoJ25vdGlmeScsIGZ1bmN0aW9uKCkge1xuICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgfSk7XG4gIH1cblxuICB0aGlzLl9ub2JsZS5ub3RpZnkoXG4gICAgdGhpcy5fcGVyaXBoZXJhbFV1aWQsXG4gICAgdGhpcy5fc2VydmljZVV1aWQsXG4gICAgdGhpcy51dWlkLFxuICAgIG5vdGlmeVxuICApO1xufTtcblxuQ2hhcmFjdGVyaXN0aWMucHJvdG90eXBlLmRpc2NvdmVyRGVzY3JpcHRvcnMgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICBpZiAoY2FsbGJhY2spIHtcbiAgICB0aGlzLm9uY2UoJ2Rlc2NyaXB0b3JzRGlzY292ZXInLCBmdW5jdGlvbihkZXNjcmlwdG9ycykge1xuICAgICAgY2FsbGJhY2sobnVsbCwgZGVzY3JpcHRvcnMpO1xuICAgIH0pO1xuICB9XG5cbiAgdGhpcy5fbm9ibGUuZGlzY292ZXJEZXNjcmlwdG9ycyhcbiAgICB0aGlzLl9wZXJpcGhlcmFsVXVpZCxcbiAgICB0aGlzLl9zZXJ2aWNlVXVpZCxcbiAgICB0aGlzLnV1aWRcbiAgKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2hhcmFjdGVyaXN0aWM7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiSXJYVXN1XCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbm9kZV9tb2R1bGVzL25vYmxlL2xpYi9jaGFyYWN0ZXJpc3RpYy5qc1wiLFwiL25vZGVfbW9kdWxlcy9ub2JsZS9saWJcIikiLCJtb2R1bGUuZXhwb3J0cz17XG4gICAgXCIyYTAwXCIgOiB7IFwibmFtZVwiIDogXCJEZXZpY2UgTmFtZVwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5nYXAuZGV2aWNlX25hbWVcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhMDFcIiA6IHsgXCJuYW1lXCIgOiBcIkFwcGVhcmFuY2VcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMuZ2FwLmFwcGVhcmFuY2VcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhMDJcIiA6IHsgXCJuYW1lXCIgOiBcIlBlcmlwaGVyYWwgUHJpdmFjeSBGbGFnXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLmdhcC5wZXJpcGhlcmFsX3ByaXZhY3lfZmxhZ1wiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmEwM1wiIDogeyBcIm5hbWVcIiA6IFwiUmVjb25uZWN0aW9uIEFkZHJlc3NcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMuZ2FwLnJlY29ubmVjdGlvbl9hZGRyZXNzXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTA0XCIgOiB7IFwibmFtZVwiIDogXCJQZXJpcGhlcmFsIFByZWZlcnJlZCBDb25uZWN0aW9uIFBhcmFtZXRlcnNcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMuZ2FwLnBlcmlwaGVyYWxfcHJlZmVycmVkX2Nvbm5lY3Rpb25fcGFyYW1ldGVyc1wiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmEwNVwiIDogeyBcIm5hbWVcIiA6IFwiU2VydmljZSBDaGFuZ2VkXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLmdhdHQuc2VydmljZV9jaGFuZ2VkXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTA2XCIgOiB7IFwibmFtZVwiIDogXCJBbGVydCBMZXZlbFwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5hbGVydF9sZXZlbFwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmEwN1wiIDogeyBcIm5hbWVcIiA6IFwiVHggUG93ZXIgTGV2ZWxcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMudHhfcG93ZXJfbGV2ZWxcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhMDhcIiA6IHsgXCJuYW1lXCIgOiBcIkRhdGUgVGltZVwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5kYXRlX3RpbWVcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhMDlcIiA6IHsgXCJuYW1lXCIgOiBcIkRheSBvZiBXZWVrXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLmRheV9vZl93ZWVrXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTBhXCIgOiB7IFwibmFtZVwiIDogXCJEYXkgRGF0ZSBUaW1lXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLmRheV9kYXRlX3RpbWVcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhMGNcIiA6IHsgXCJuYW1lXCIgOiBcIkV4YWN0IFRpbWUgMjU2XCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLmV4YWN0X3RpbWVfMjU2XCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTBkXCIgOiB7IFwibmFtZVwiIDogXCJEU1QgT2Zmc2V0XCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLmRzdF9vZmZzZXRcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhMGVcIiA6IHsgXCJuYW1lXCIgOiBcIlRpbWUgWm9uZVwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy50aW1lX3pvbmVcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhMGZcIiA6IHsgXCJuYW1lXCIgOiBcIkxvY2FsIFRpbWUgSW5mb3JtYXRpb25cIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMubG9jYWxfdGltZV9pbmZvcm1hdGlvblwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmExMVwiIDogeyBcIm5hbWVcIiA6IFwiVGltZSB3aXRoIERTVFwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy50aW1lX3dpdGhfZHN0XCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTEyXCIgOiB7IFwibmFtZVwiIDogXCJUaW1lIEFjY3VyYWN5XCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLnRpbWVfYWNjdXJhY3lcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhMTNcIiA6IHsgXCJuYW1lXCIgOiBcIlRpbWUgU291cmNlXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLnRpbWVfc291cmNlXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTE0XCIgOiB7IFwibmFtZVwiIDogXCJSZWZlcmVuY2UgVGltZSBJbmZvcm1hdGlvblwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5yZWZlcmVuY2VfdGltZV9pbmZvcm1hdGlvblwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmExNlwiIDogeyBcIm5hbWVcIiA6IFwiVGltZSBVcGRhdGUgQ29udHJvbCBQb2ludFwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy50aW1lX3VwZGF0ZV9jb250cm9sX3BvaW50XCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTE3XCIgOiB7IFwibmFtZVwiIDogXCJUaW1lIFVwZGF0ZSBTdGF0ZVwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy50aW1lX3VwZGF0ZV9zdGF0ZVwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmExOFwiIDogeyBcIm5hbWVcIiA6IFwiR2x1Y29zZSBNZWFzdXJlbWVudFwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5nbHVjb3NlX21lYXN1cmVtZW50XCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTE5XCIgOiB7IFwibmFtZVwiIDogXCJCYXR0ZXJ5IExldmVsXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLmJhdHRlcnlfbGV2ZWxcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhMWNcIiA6IHsgXCJuYW1lXCIgOiBcIlRlbXBlcmF0dXJlIE1lYXN1cmVtZW50XCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLnRlbXBlcmF0dXJlX21lYXN1cmVtZW50XCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTFkXCIgOiB7IFwibmFtZVwiIDogXCJUZW1wZXJhdHVyZSBUeXBlXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLnRlbXBlcmF0dXJlX3R5cGVcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhMWVcIiA6IHsgXCJuYW1lXCIgOiBcIkludGVybWVkaWF0ZSBUZW1wZXJhdHVyZVwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5pbnRlcm1lZGlhdGVfdGVtcGVyYXR1cmVcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhMjFcIiA6IHsgXCJuYW1lXCIgOiBcIk1lYXN1cmVtZW50IEludGVydmFsXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLm1lYXN1cmVtZW50X2ludGVydmFsXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTIyXCIgOiB7IFwibmFtZVwiIDogXCJCb290IEtleWJvYXJkIElucHV0IFJlcG9ydFwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5ib290X2tleWJvYXJkX2lucHV0X3JlcG9ydFwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmEyM1wiIDogeyBcIm5hbWVcIiA6IFwiU3lzdGVtIElEXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLnN5c3RlbV9pZFwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmEyNFwiIDogeyBcIm5hbWVcIiA6IFwiTW9kZWwgTnVtYmVyIFN0cmluZ1wiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5tb2RlbF9udW1iZXJfc3RyaW5nXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTI1XCIgOiB7IFwibmFtZVwiIDogXCJTZXJpYWwgTnVtYmVyIFN0cmluZ1wiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5zZXJpYWxfbnVtYmVyX3N0cmluZ1wiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmEyNlwiIDogeyBcIm5hbWVcIiA6IFwiRmlybXdhcmUgUmV2aXNpb24gU3RyaW5nXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLmZpcm13YXJlX3JldmlzaW9uX3N0cmluZ1wiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmEyN1wiIDogeyBcIm5hbWVcIiA6IFwiSGFyZHdhcmUgUmV2aXNpb24gU3RyaW5nXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLmhhcmR3YXJlX3JldmlzaW9uX3N0cmluZ1wiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmEyOFwiIDogeyBcIm5hbWVcIiA6IFwiU29mdHdhcmUgUmV2aXNpb24gU3RyaW5nXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLnNvZnR3YXJlX3JldmlzaW9uX3N0cmluZ1wiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmEyOVwiIDogeyBcIm5hbWVcIiA6IFwiTWFudWZhY3R1cmVyIE5hbWUgU3RyaW5nXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLm1hbnVmYWN0dXJlcl9uYW1lX3N0cmluZ1wiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmEyYVwiIDogeyBcIm5hbWVcIiA6IFwiSUVFRSAxMTA3My0yMDYwMSBSZWd1bGF0b3J5IENlcnRpZmljYXRpb24gRGF0YSBMaXN0XCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLmllZWVfMTEwNzMtMjA2MDFfcmVndWxhdG9yeV9jZXJ0aWZpY2F0aW9uX2RhdGFfbGlzdFwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmEyYlwiIDogeyBcIm5hbWVcIiA6IFwiQ3VycmVudCBUaW1lXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLmN1cnJlbnRfdGltZVwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmEzMVwiIDogeyBcIm5hbWVcIiA6IFwiU2NhbiBSZWZyZXNoXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLnNjYW5fcmVmcmVzaFwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmEzMlwiIDogeyBcIm5hbWVcIiA6IFwiQm9vdCBLZXlib2FyZCBPdXRwdXQgUmVwb3J0XCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLmJvb3Rfa2V5Ym9hcmRfb3V0cHV0X3JlcG9ydFwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmEzM1wiIDogeyBcIm5hbWVcIiA6IFwiQm9vdCBNb3VzZSBJbnB1dCBSZXBvcnRcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMuYm9vdF9tb3VzZV9pbnB1dF9yZXBvcnRcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhMzRcIiA6IHsgXCJuYW1lXCIgOiBcIkdsdWNvc2UgTWVhc3VyZW1lbnQgQ29udGV4dFwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5nbHVjb3NlX21lYXN1cmVtZW50X2NvbnRleHRcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhMzVcIiA6IHsgXCJuYW1lXCIgOiBcIkJsb29kIFByZXNzdXJlIE1lYXN1cmVtZW50XCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLmJsb29kX3ByZXNzdXJlX21lYXN1cmVtZW50XCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTM2XCIgOiB7IFwibmFtZVwiIDogXCJJbnRlcm1lZGlhdGUgQ3VmZiBQcmVzc3VyZVwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5pbnRlcm1lZGlhdGVfYmxvb2RfcHJlc3N1cmVcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhMzdcIiA6IHsgXCJuYW1lXCIgOiBcIkhlYXJ0IFJhdGUgTWVhc3VyZW1lbnRcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMuaGVhcnRfcmF0ZV9tZWFzdXJlbWVudFwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmEzOFwiIDogeyBcIm5hbWVcIiA6IFwiQm9keSBTZW5zb3IgTG9jYXRpb25cIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMuYm9keV9zZW5zb3JfbG9jYXRpb25cIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhMzlcIiA6IHsgXCJuYW1lXCIgOiBcIkhlYXJ0IFJhdGUgQ29udHJvbCBQb2ludFwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5oZWFydF9yYXRlX2NvbnRyb2xfcG9pbnRcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhM2ZcIiA6IHsgXCJuYW1lXCIgOiBcIkFsZXJ0IFN0YXR1c1wiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5hbGVydF9zdGF0dXNcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhNDBcIiA6IHsgXCJuYW1lXCIgOiBcIlJpbmdlciBDb250cm9sIFBvaW50XCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLnJpbmdlcl9jb250cm9sX3BvaW50XCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTQxXCIgOiB7IFwibmFtZVwiIDogXCJSaW5nZXIgU2V0dGluZ1wiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5yaW5nZXJfc2V0dGluZ1wiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmE0MlwiIDogeyBcIm5hbWVcIiA6IFwiQWxlcnQgQ2F0ZWdvcnkgSUQgQml0IE1hc2tcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMuYWxlcnRfY2F0ZWdvcnlfaWRfYml0X21hc2tcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhNDNcIiA6IHsgXCJuYW1lXCIgOiBcIkFsZXJ0IENhdGVnb3J5IElEXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLmFsZXJ0X2NhdGVnb3J5X2lkXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTQ0XCIgOiB7IFwibmFtZVwiIDogXCJBbGVydCBOb3RpZmljYXRpb24gQ29udHJvbCBQb2ludFwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5hbGVydF9ub3RpZmljYXRpb25fY29udHJvbF9wb2ludFwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmE0NVwiIDogeyBcIm5hbWVcIiA6IFwiVW5yZWFkIEFsZXJ0IFN0YXR1c1wiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy51bnJlYWRfYWxlcnRfc3RhdHVzXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTQ2XCIgOiB7IFwibmFtZVwiIDogXCJOZXcgQWxlcnRcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMubmV3X2FsZXJ0XCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTQ3XCIgOiB7IFwibmFtZVwiIDogXCJTdXBwb3J0ZWQgTmV3IEFsZXJ0IENhdGVnb3J5XCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLnN1cHBvcnRlZF9uZXdfYWxlcnRfY2F0ZWdvcnlcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhNDhcIiA6IHsgXCJuYW1lXCIgOiBcIlN1cHBvcnRlZCBVbnJlYWQgQWxlcnQgQ2F0ZWdvcnlcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMuc3VwcG9ydGVkX3VucmVhZF9hbGVydF9jYXRlZ29yeVwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmE0OVwiIDogeyBcIm5hbWVcIiA6IFwiQmxvb2QgUHJlc3N1cmUgRmVhdHVyZVwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5ibG9vZF9wcmVzc3VyZV9mZWF0dXJlXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTRhXCIgOiB7IFwibmFtZVwiIDogXCJISUQgSW5mb3JtYXRpb25cIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMuaGlkX2luZm9ybWF0aW9uXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTRiXCIgOiB7IFwibmFtZVwiIDogXCJSZXBvcnQgTWFwXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLnJlcG9ydF9tYXBcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhNGNcIiA6IHsgXCJuYW1lXCIgOiBcIkhJRCBDb250cm9sIFBvaW50XCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLmhpZF9jb250cm9sX3BvaW50XCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTRkXCIgOiB7IFwibmFtZVwiIDogXCJSZXBvcnRcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMucmVwb3J0XCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTRlXCIgOiB7IFwibmFtZVwiIDogXCJQcm90b2NvbCBNb2RlXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLnByb3RvY29sX21vZGVcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjJhNGZcIiA6IHsgXCJuYW1lXCIgOiBcIlNjYW4gSW50ZXJ2YWwgV2luZG93XCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLnNjYW5faW50ZXJ2YWxfd2luZG93XCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTUwXCIgOiB7IFwibmFtZVwiIDogXCJQblAgSURcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMucG5wX2lkXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTUxXCIgOiB7IFwibmFtZVwiIDogXCJHbHVjb3NlIEZlYXR1cmVcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMuZ2x1Y29zZV9mZWF0dXJlXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTUyXCIgOiB7IFwibmFtZVwiIDogXCJSZWNvcmQgQWNjZXNzIENvbnRyb2wgUG9pbnRcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMucmVjb3JkX2FjY2Vzc19jb250cm9sX3BvaW50XCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTUzXCIgOiB7IFwibmFtZVwiIDogXCJSU0MgTWVhc3VyZW1lbnRcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMucnNjX21lYXN1cmVtZW50XCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTU0XCIgOiB7IFwibmFtZVwiIDogXCJSU0MgRmVhdHVyZVwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5yc2NfZmVhdHVyZVwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmE1NVwiIDogeyBcIm5hbWVcIiA6IFwiU0MgQ29udHJvbCBQb2ludFwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5zY19jb250cm9sX3BvaW50XCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTViXCIgOiB7IFwibmFtZVwiIDogXCJDU0MgTWVhc3VyZW1lbnRcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguY2hhcmFjdGVyaXN0aWMuY3NjX21lYXN1cmVtZW50XCJcbiAgICAgICAgICAgICB9XG4gICwgXCIyYTVjXCIgOiB7IFwibmFtZVwiIDogXCJDU0MgRmVhdHVyZVwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5jaGFyYWN0ZXJpc3RpYy5jc2NfZmVhdHVyZVwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMmE1ZFwiIDogeyBcIm5hbWVcIiA6IFwiU2Vuc29yIExvY2F0aW9uXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmNoYXJhY3RlcmlzdGljLnNlbnNvcl9sb2NhdGlvblwiXG4gICAgICAgICAgICAgfVxufSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJykoJ2Rlc2NyaXB0b3InKTtcblxudmFyIGV2ZW50cyA9IHJlcXVpcmUoJ2V2ZW50cycpO1xudmFyIHV0aWwgPSByZXF1aXJlKCd1dGlsJyk7XG5cbnZhciBkZXNjcmlwdG9ycyA9IHJlcXVpcmUoJy4vZGVzY3JpcHRvcnMuanNvbicpO1xuXG5mdW5jdGlvbiBEZXNjcmlwdG9yKG5vYmxlLCBwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgdXVpZCkge1xuICB0aGlzLl9ub2JsZSA9IG5vYmxlO1xuICB0aGlzLl9wZXJpcGhlcmFsVXVpZCA9IHBlcmlwaGVyYWxVdWlkO1xuICB0aGlzLl9zZXJ2aWNlVXVpZCA9IHNlcnZpY2VVdWlkO1xuICB0aGlzLl9jaGFyYWN0ZXJpc3RpY1V1aWQgPSBjaGFyYWN0ZXJpc3RpY1V1aWQ7XG5cbiAgdGhpcy51dWlkID0gdXVpZDtcbiAgdGhpcy5uYW1lID0gbnVsbDtcbiAgdGhpcy50eXBlID0gbnVsbDtcblxuICB2YXIgZGVzY3JpcHRvciA9IGRlc2NyaXB0b3JzW3V1aWRdO1xuICBpZiAoZGVzY3JpcHRvcikge1xuICAgIHRoaXMubmFtZSA9IGRlc2NyaXB0b3IubmFtZTtcbiAgICB0aGlzLnR5cGUgPSBkZXNjcmlwdG9yLnR5cGU7XG4gIH1cbn1cblxudXRpbC5pbmhlcml0cyhEZXNjcmlwdG9yLCBldmVudHMuRXZlbnRFbWl0dGVyKTtcblxuRGVzY3JpcHRvci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICB1dWlkOiB0aGlzLnV1aWQsXG4gICAgbmFtZTogdGhpcy5uYW1lLFxuICAgIHR5cGU6IHRoaXMudHlwZVxuICB9KTtcbn07XG5cbkRlc2NyaXB0b3IucHJvdG90eXBlLnJlYWRWYWx1ZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIGlmIChjYWxsYmFjaykge1xuICAgIHRoaXMub24oJ3ZhbHVlUmVhZCcsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIGNhbGxiYWNrKG51bGwsIGRhdGEpO1xuICAgIH0pO1xuICB9XG4gIHRoaXMuX25vYmxlLnJlYWRWYWx1ZShcbiAgICB0aGlzLl9wZXJpcGhlcmFsVXVpZCxcbiAgICB0aGlzLl9zZXJ2aWNlVXVpZCxcbiAgICB0aGlzLl9jaGFyYWN0ZXJpc3RpY1V1aWQsXG4gICAgdGhpcy51dWlkXG4gICk7XG59O1xuXG5EZXNjcmlwdG9yLnByb3RvdHlwZS53cml0ZVZhbHVlID0gZnVuY3Rpb24oZGF0YSwgY2FsbGJhY2spIHtcbiAgaWYgKCEoZGF0YSBpbnN0YW5jZW9mIEJ1ZmZlcikpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2RhdGEgbXVzdCBiZSBhIEJ1ZmZlcicpO1xuICB9XG5cbiAgaWYgKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5vbigndmFsdWVXcml0ZScsIGZ1bmN0aW9uKCkge1xuICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgfSk7XG4gIH1cbiAgdGhpcy5fbm9ibGUud3JpdGVWYWx1ZShcbiAgICB0aGlzLl9wZXJpcGhlcmFsVXVpZCxcbiAgICB0aGlzLl9zZXJ2aWNlVXVpZCxcbiAgICB0aGlzLl9jaGFyYWN0ZXJpc3RpY1V1aWQsXG4gICAgdGhpcy51dWlkLFxuICAgIGRhdGFcbiAgKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRGVzY3JpcHRvcjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJJclhVc3VcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9ub2RlX21vZHVsZXMvbm9ibGUvbGliL2Rlc2NyaXB0b3IuanNcIixcIi9ub2RlX21vZHVsZXMvbm9ibGUvbGliXCIpIiwibW9kdWxlLmV4cG9ydHM9e1xuICAgIFwiMjkwMFwiIDogeyBcIm5hbWVcIiA6IFwiQ2hhcmFjdGVyaXN0aWMgRXh0ZW5kZWQgUHJvcGVydGllc1wiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5kZXNjcmlwdG9yLmdhdHQuY2hhcmFjdGVyaXN0aWNfZXh0ZW5kZWRfcHJvcGVydGllc1wiXG4gICAgICAgfVxuICAsIFwiMjkwMVwiIDogeyBcIm5hbWVcIiA6IFwiQ2hhcmFjdGVyaXN0aWMgVXNlciBEZXNjcmlwdGlvblwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5kZXNjcmlwdG9yLmdhdHQuY2hhcmFjdGVyaXN0aWNfdXNlcl9kZXNjcmlwdGlvblwiXG4gICAgICAgfVxuICAsIFwiMjkwMlwiIDogeyBcIm5hbWVcIiA6IFwiQ2xpZW50IENoYXJhY3RlcmlzdGljIENvbmZpZ3VyYXRpb25cIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguZGVzY3JpcHRvci5nYXR0LmNsaWVudF9jaGFyYWN0ZXJpc3RpY19jb25maWd1cmF0aW9uXCJcbiAgICAgICB9XG4gICwgXCIyOTAzXCIgOiB7IFwibmFtZVwiIDogXCJTZXJ2ZXIgQ2hhcmFjdGVyaXN0aWMgQ29uZmlndXJhdGlvblwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5kZXNjcmlwdG9yLmdhdHQuc2VydmVyX2NoYXJhY3RlcmlzdGljX2NvbmZpZ3VyYXRpb25cIlxuICAgICAgIH1cbiAgLCBcIjI5MDRcIiA6IHsgXCJuYW1lXCIgOiBcIkNoYXJhY3RlcmlzdGljIFByZXNlbnRhdGlvbiBGb3JtYXRcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguZGVzY3JpcHRvci5nYXR0LmNoYXJhY3RlcmlzdGljX3ByZXNlbnRhdGlvbl9mb3JtYXRcIlxuICAgICAgIH1cbiAgLCBcIjI5MDVcIiA6IHsgXCJuYW1lXCIgOiBcIkNoYXJhY3RlcmlzdGljIEFnZ3JlZ2F0ZSBGb3JtYXRcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguZGVzY3JpcHRvci5nYXR0LmNoYXJhY3RlcmlzdGljX2FnZ3JlZ2F0ZV9mb3JtYXRcIlxuICAgICAgIH1cbiAgLCBcIjI5MDZcIiA6IHsgXCJuYW1lXCIgOiBcIlZhbGlkIFJhbmdlXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmRlc2NyaXB0b3IudmFsaWRfcmFuZ2VcIlxuICAgICAgIH1cbiAgLCBcIjI5MDdcIiA6IHsgXCJuYW1lXCIgOiBcIkV4dGVybmFsIFJlcG9ydCBSZWZlcmVuY2VcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguZGVzY3JpcHRvci5leHRlcm5hbF9yZXBvcnRfcmVmZXJlbmNlXCJcbiAgICAgICB9XG4gICwgXCIyOTA4XCIgOiB7IFwibmFtZVwiIDogXCJSZXBvcnQgUmVmZXJlbmNlXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLmRlc2NyaXB0b3IucmVwb3J0X3JlZmVyZW5jZVwiXG4gICAgICAgfVxufSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJykoJ25vYmxlJyk7XG5cbnZhciBldmVudHMgPSByZXF1aXJlKCdldmVudHMnKTtcbnZhciBvcyA9IHJlcXVpcmUoJ29zJyk7XG52YXIgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKTtcblxudmFyIFBlcmlwaGVyYWwgPSByZXF1aXJlKCcuL3BlcmlwaGVyYWwnKTtcbnZhciBTZXJ2aWNlID0gcmVxdWlyZSgnLi9zZXJ2aWNlJyk7XG52YXIgQ2hhcmFjdGVyaXN0aWMgPSByZXF1aXJlKCcuL2NoYXJhY3RlcmlzdGljJyk7XG52YXIgRGVzY3JpcHRvciA9IHJlcXVpcmUoJy4vZGVzY3JpcHRvcicpO1xuXG52YXIgYmluZGluZ3MgPSBudWxsO1xuXG52YXIgcGxhdGZvcm0gPSBvcy5wbGF0Zm9ybSgpO1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9CTEVfV0VCU09DS0VUIHx8IHByb2Nlc3MudGl0bGUgPT09ICdicm93c2VyJykge1xuICBiaW5kaW5ncyA9IHJlcXVpcmUoJy4vYnJvd3NlcicpO1xufSBlbHNlIGlmIChwcm9jZXNzLmVudi5OT0JMRV9ESVNUUklCVVRFRCkge1xuICBiaW5kaW5ncyA9IHJlcXVpcmUoJy4vZGlzdHJpYnV0ZWQvYmluZGluZ3MnKTtcbn0gZWxzZSBpZiAocGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gIGJpbmRpbmdzID0gcmVxdWlyZSgnLi9tYWMvYmluZGluZ3MnKTtcbn0gZWxzZSBpZiAocGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgYmluZGluZ3MgPSByZXF1aXJlKCcuL2xpbnV4L2JpbmRpbmdzJyk7XG59IGVsc2Uge1xuICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIHBsYXRmb3JtJyk7XG59XG5cbmZ1bmN0aW9uIE5vYmxlKCkge1xuICB0aGlzLnN0YXRlID0gJ3Vua25vd24nO1xuXG4gIHRoaXMuX2JpbmRpbmdzID0gYmluZGluZ3M7XG4gIHRoaXMuX3BlcmlwaGVyYWxzID0ge307XG4gIHRoaXMuX3NlcnZpY2VzID0ge307XG4gIHRoaXMuX2NoYXJhY3RlcmlzdGljcyA9IHt9O1xuICB0aGlzLl9kZXNjcmlwdG9ycyA9IHt9O1xuXG4gIHRoaXMuX2JpbmRpbmdzLm9uKCdzdGF0ZUNoYW5nZScsIHRoaXMub25TdGF0ZUNoYW5nZS5iaW5kKHRoaXMpKTtcbiAgdGhpcy5fYmluZGluZ3Mub24oJ3NjYW5TdGFydCcsIHRoaXMub25TY2FuU3RhcnQuYmluZCh0aGlzKSk7XG4gIHRoaXMuX2JpbmRpbmdzLm9uKCdzY2FuU3RvcCcsIHRoaXMub25TY2FuU3RvcC5iaW5kKHRoaXMpKTtcbiAgdGhpcy5fYmluZGluZ3Mub24oJ2Rpc2NvdmVyJywgdGhpcy5vbkRpc2NvdmVyLmJpbmQodGhpcykpO1xuICB0aGlzLl9iaW5kaW5ncy5vbignY29ubmVjdCcsIHRoaXMub25Db25uZWN0LmJpbmQodGhpcykpO1xuICB0aGlzLl9iaW5kaW5ncy5vbignZGlzY29ubmVjdCcsIHRoaXMub25EaXNjb25uZWN0LmJpbmQodGhpcykpO1xuICB0aGlzLl9iaW5kaW5ncy5vbigncnNzaVVwZGF0ZScsIHRoaXMub25Sc3NpVXBkYXRlLmJpbmQodGhpcykpO1xuICB0aGlzLl9iaW5kaW5ncy5vbignc2VydmljZXNEaXNjb3ZlcicsIHRoaXMub25TZXJ2aWNlc0Rpc2NvdmVyLmJpbmQodGhpcykpO1xuICB0aGlzLl9iaW5kaW5ncy5vbignaW5jbHVkZWRTZXJ2aWNlc0Rpc2NvdmVyJywgdGhpcy5vbkluY2x1ZGVkU2VydmljZXNEaXNjb3Zlci5iaW5kKHRoaXMpKTtcbiAgdGhpcy5fYmluZGluZ3Mub24oJ2NoYXJhY3RlcmlzdGljc0Rpc2NvdmVyJywgdGhpcy5vbkNoYXJhY3RlcmlzdGljc0Rpc2NvdmVyLmJpbmQodGhpcykpO1xuICB0aGlzLl9iaW5kaW5ncy5vbigncmVhZCcsIHRoaXMub25SZWFkLmJpbmQodGhpcykpO1xuICB0aGlzLl9iaW5kaW5ncy5vbignd3JpdGUnLCB0aGlzLm9uV3JpdGUuYmluZCh0aGlzKSk7XG4gIHRoaXMuX2JpbmRpbmdzLm9uKCdicm9hZGNhc3QnLCB0aGlzLm9uQnJvYWRjYXN0LmJpbmQodGhpcykpO1xuICB0aGlzLl9iaW5kaW5ncy5vbignbm90aWZ5JywgdGhpcy5vbk5vdGlmeS5iaW5kKHRoaXMpKTtcbiAgdGhpcy5fYmluZGluZ3Mub24oJ2Rlc2NyaXB0b3JzRGlzY292ZXInLCB0aGlzLm9uRGVzY3JpcHRvcnNEaXNjb3Zlci5iaW5kKHRoaXMpKTtcbiAgdGhpcy5fYmluZGluZ3Mub24oJ3ZhbHVlUmVhZCcsIHRoaXMub25WYWx1ZVJlYWQuYmluZCh0aGlzKSk7XG4gIHRoaXMuX2JpbmRpbmdzLm9uKCd2YWx1ZVdyaXRlJywgdGhpcy5vblZhbHVlV3JpdGUuYmluZCh0aGlzKSk7XG4gIHRoaXMuX2JpbmRpbmdzLm9uKCdoYW5kbGVSZWFkJywgdGhpcy5vbkhhbmRsZVJlYWQuYmluZCh0aGlzKSk7XG4gIHRoaXMuX2JpbmRpbmdzLm9uKCdoYW5kbGVXcml0ZScsIHRoaXMub25IYW5kbGVXcml0ZS5iaW5kKHRoaXMpKTtcbiAgdGhpcy5fYmluZGluZ3Mub24oJ2hhbmRsZU5vdGlmeScsIHRoaXMub25IYW5kbGVOb3RpZnkuYmluZCh0aGlzKSk7XG59XG5cbnV0aWwuaW5oZXJpdHMoTm9ibGUsIGV2ZW50cy5FdmVudEVtaXR0ZXIpO1xuXG5Ob2JsZS5wcm90b3R5cGUub25TdGF0ZUNoYW5nZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gIGRlYnVnKCdzdGF0ZUNoYW5nZSAnICsgc3RhdGUpO1xuXG4gIHRoaXMuc3RhdGUgPSBzdGF0ZTtcblxuICB0aGlzLmVtaXQoJ3N0YXRlQ2hhbmdlJywgc3RhdGUpO1xufTtcblxuTm9ibGUucHJvdG90eXBlLnN0YXJ0U2Nhbm5pbmcgPSBmdW5jdGlvbihzZXJ2aWNlVXVpZHMsIGFsbG93RHVwbGljYXRlcywgY2FsbGJhY2spIHtcbiAgaWYgKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5vbmNlKCdzY2FuU3RhcnQnLCBjYWxsYmFjayk7XG4gIH1cblxuICB0aGlzLl9kaXNjb3ZlcmVkUGVyaXBoZXJhbFVVaWRzID0gW107XG4gIHRoaXMuX2FsbG93RHVwbGljYXRlcyA9IGFsbG93RHVwbGljYXRlcztcblxuICB0aGlzLl9iaW5kaW5ncy5zdGFydFNjYW5uaW5nKHNlcnZpY2VVdWlkcywgYWxsb3dEdXBsaWNhdGVzKTtcbn07XG5cbk5vYmxlLnByb3RvdHlwZS5vblNjYW5TdGFydCA9IGZ1bmN0aW9uKCkge1xuICBkZWJ1Zygnc2NhblN0YXJ0Jyk7XG4gIHRoaXMuZW1pdCgnc2NhblN0YXJ0Jyk7XG59O1xuXG5Ob2JsZS5wcm90b3R5cGUuc3RvcFNjYW5uaW5nID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgaWYgKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5vbmNlKCdzY2FuU3RvcCcsIGNhbGxiYWNrKTtcbiAgfVxuICB0aGlzLl9iaW5kaW5ncy5zdG9wU2Nhbm5pbmcoKTtcbn07XG5cbk5vYmxlLnByb3RvdHlwZS5vblNjYW5TdG9wID0gZnVuY3Rpb24oKSB7XG4gIGRlYnVnKCdzY2FuU3RvcCcpO1xuICB0aGlzLmVtaXQoJ3NjYW5TdG9wJyk7XG59O1xuXG5Ob2JsZS5wcm90b3R5cGUub25EaXNjb3ZlciA9IGZ1bmN0aW9uKHV1aWQsIGFkdmVydGlzZW1lbnQsIHJzc2kpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1t1dWlkXTtcblxuICBpZiAoIXBlcmlwaGVyYWwpIHtcbiAgICBwZXJpcGhlcmFsID0gbmV3IFBlcmlwaGVyYWwodGhpcywgdXVpZCwgYWR2ZXJ0aXNlbWVudCwgcnNzaSk7XG5cbiAgICB0aGlzLl9wZXJpcGhlcmFsc1t1dWlkXSA9IHBlcmlwaGVyYWw7XG4gICAgdGhpcy5fc2VydmljZXNbdXVpZF0gPSB7fTtcbiAgICB0aGlzLl9jaGFyYWN0ZXJpc3RpY3NbdXVpZF0gPSB7fTtcbiAgICB0aGlzLl9kZXNjcmlwdG9yc1t1dWlkXSA9IHt9O1xuICB9IGVsc2Uge1xuICAgIC8vIFwib3JcIiB0aGUgYWR2ZXJ0aXNtZW50IGRhdGEgd2l0aCBleGlzdGluZ1xuICAgIGZvciAodmFyIGkgaW4gYWR2ZXJ0aXNlbWVudCkge1xuICAgICAgaWYgKGFkdmVydGlzZW1lbnRbaV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwZXJpcGhlcmFsLmFkdmVydGlzZW1lbnRbaV0gPSBhZHZlcnRpc2VtZW50W2ldO1xuICAgICAgfVxuICAgIH1cblxuICAgIHBlcmlwaGVyYWwucnNzaSA9IHJzc2k7XG4gIH1cblxuICB2YXIgcHJldmlvdXNseURpc2NvdmVyZCA9ICh0aGlzLl9kaXNjb3ZlcmVkUGVyaXBoZXJhbFVVaWRzLmluZGV4T2YodXVpZCkgIT09IC0xKTtcblxuICBpZiAoIXByZXZpb3VzbHlEaXNjb3ZlcmQpIHtcbiAgICB0aGlzLl9kaXNjb3ZlcmVkUGVyaXBoZXJhbFVVaWRzLnB1c2godXVpZCk7XG4gIH1cblxuICBpZiAodGhpcy5fYWxsb3dEdXBsaWNhdGVzIHx8ICFwcmV2aW91c2x5RGlzY292ZXJkKSB7XG4gICAgdGhpcy5lbWl0KCdkaXNjb3ZlcicsIHBlcmlwaGVyYWwpO1xuICB9XG59O1xuXG5Ob2JsZS5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKHBlcmlwaGVyYWxVdWlkKSB7XG4gIHRoaXMuX2JpbmRpbmdzLmNvbm5lY3QocGVyaXBoZXJhbFV1aWQpO1xufTtcblxuTm9ibGUucHJvdG90eXBlLm9uQ29ubmVjdCA9IGZ1bmN0aW9uKHBlcmlwaGVyYWxVdWlkLCBlcnJvcikge1xuICB2YXIgcGVyaXBoZXJhbCA9IHRoaXMuX3BlcmlwaGVyYWxzW3BlcmlwaGVyYWxVdWlkXTtcblxuICBpZiAocGVyaXBoZXJhbCkge1xuICAgIHBlcmlwaGVyYWwuc3RhdGUgPSAnY29ubmVjdGVkJztcbiAgICBwZXJpcGhlcmFsLmVtaXQoJ2Nvbm5lY3QnLCBlcnJvcik7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS53YXJuKCdub2JsZTogdW5rbm93biBwZXJpcGhlcmFsICcgKyBwZXJpcGhlcmFsVXVpZCArICcgY29ubmVjdGVkIScpO1xuICB9XG59O1xuXG5Ob2JsZS5wcm90b3R5cGUuZGlzY29ubmVjdCA9IGZ1bmN0aW9uKHBlcmlwaGVyYWxVdWlkKSB7XG4gIHRoaXMuX2JpbmRpbmdzLmRpc2Nvbm5lY3QocGVyaXBoZXJhbFV1aWQpO1xufTtcblxuTm9ibGUucHJvdG90eXBlLm9uRGlzY29ubmVjdCA9IGZ1bmN0aW9uKHBlcmlwaGVyYWxVdWlkKSB7XG4gIHZhciBwZXJpcGhlcmFsID0gdGhpcy5fcGVyaXBoZXJhbHNbcGVyaXBoZXJhbFV1aWRdO1xuXG4gIGlmIChwZXJpcGhlcmFsKSB7XG4gICAgcGVyaXBoZXJhbC5zdGF0ZSA9ICdkaXNjb25uZWN0ZWQnO1xuICAgIHBlcmlwaGVyYWwuZW1pdCgnZGlzY29ubmVjdCcpO1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUud2Fybignbm9ibGU6IHVua25vd24gcGVyaXBoZXJhbCAnICsgcGVyaXBoZXJhbFV1aWQgKyAnIGRpc2Nvbm5lY3RlZCEnKTtcbiAgfVxufTtcblxuTm9ibGUucHJvdG90eXBlLnVwZGF0ZVJzc2kgPSBmdW5jdGlvbihwZXJpcGhlcmFsVXVpZCkge1xuICB0aGlzLl9iaW5kaW5ncy51cGRhdGVSc3NpKHBlcmlwaGVyYWxVdWlkKTtcbn07XG5cbk5vYmxlLnByb3RvdHlwZS5vblJzc2lVcGRhdGUgPSBmdW5jdGlvbihwZXJpcGhlcmFsVXVpZCwgcnNzaSkge1xuICB2YXIgcGVyaXBoZXJhbCA9IHRoaXMuX3BlcmlwaGVyYWxzW3BlcmlwaGVyYWxVdWlkXTtcblxuICBpZiAocGVyaXBoZXJhbCkge1xuICAgIHBlcmlwaGVyYWwucnNzaSA9IHJzc2k7XG5cbiAgICBwZXJpcGhlcmFsLmVtaXQoJ3Jzc2lVcGRhdGUnLCByc3NpKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLndhcm4oJ25vYmxlOiB1bmtub3duIHBlcmlwaGVyYWwgJyArIHBlcmlwaGVyYWxVdWlkICsgJyBSU1NJIHVwZGF0ZSEnKTtcbiAgfVxufTtcblxuTm9ibGUucHJvdG90eXBlLmRpc2NvdmVyU2VydmljZXMgPSBmdW5jdGlvbihwZXJpcGhlcmFsVXVpZCwgdXVpZHMpIHtcbiAgdGhpcy5fYmluZGluZ3MuZGlzY292ZXJTZXJ2aWNlcyhwZXJpcGhlcmFsVXVpZCwgdXVpZHMpO1xufTtcblxuTm9ibGUucHJvdG90eXBlLm9uU2VydmljZXNEaXNjb3ZlciA9IGZ1bmN0aW9uKHBlcmlwaGVyYWxVdWlkLCBzZXJ2aWNlVXVpZHMpIHtcbiAgdmFyIHBlcmlwaGVyYWwgPSB0aGlzLl9wZXJpcGhlcmFsc1twZXJpcGhlcmFsVXVpZF07XG5cbiAgaWYgKHBlcmlwaGVyYWwpIHtcbiAgICB2YXIgc2VydmljZXMgPSBbXTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VydmljZVV1aWRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgc2VydmljZVV1aWQgPSBzZXJ2aWNlVXVpZHNbaV07XG4gICAgICB2YXIgc2VydmljZSA9IG5ldyBTZXJ2aWNlKHRoaXMsIHBlcmlwaGVyYWxVdWlkLCBzZXJ2aWNlVXVpZCk7XG5cbiAgICAgIHRoaXMuX3NlcnZpY2VzW3BlcmlwaGVyYWxVdWlkXVtzZXJ2aWNlVXVpZF0gPSBzZXJ2aWNlO1xuICAgICAgdGhpcy5fY2hhcmFjdGVyaXN0aWNzW3BlcmlwaGVyYWxVdWlkXVtzZXJ2aWNlVXVpZF0gPSB7fTtcbiAgICAgIHRoaXMuX2Rlc2NyaXB0b3JzW3BlcmlwaGVyYWxVdWlkXVtzZXJ2aWNlVXVpZF0gPSB7fTtcblxuICAgICAgc2VydmljZXMucHVzaChzZXJ2aWNlKTtcbiAgICB9XG5cbiAgICBwZXJpcGhlcmFsLnNlcnZpY2VzID0gc2VydmljZXM7XG5cbiAgICBwZXJpcGhlcmFsLmVtaXQoJ3NlcnZpY2VzRGlzY292ZXInLCBzZXJ2aWNlcyk7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS53YXJuKCdub2JsZTogdW5rbm93biBwZXJpcGhlcmFsICcgKyBwZXJpcGhlcmFsVXVpZCArICcgc2VydmljZXMgZGlzY292ZXIhJyk7XG4gIH1cbn07XG5cbk5vYmxlLnByb3RvdHlwZS5kaXNjb3ZlckluY2x1ZGVkU2VydmljZXMgPSBmdW5jdGlvbihwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIHNlcnZpY2VVdWlkcykge1xuICB0aGlzLl9iaW5kaW5ncy5kaXNjb3ZlckluY2x1ZGVkU2VydmljZXMocGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBzZXJ2aWNlVXVpZHMpO1xufTtcblxuTm9ibGUucHJvdG90eXBlLm9uSW5jbHVkZWRTZXJ2aWNlc0Rpc2NvdmVyID0gZnVuY3Rpb24ocGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBpbmNsdWRlZFNlcnZpY2VVdWlkcykge1xuICB2YXIgc2VydmljZSA9IHRoaXMuX3NlcnZpY2VzW3BlcmlwaGVyYWxVdWlkXVtzZXJ2aWNlVXVpZF07XG5cbiAgaWYgKHNlcnZpY2UpIHtcbiAgICBzZXJ2aWNlLmluY2x1ZGVkU2VydmljZVV1aWRzID0gaW5jbHVkZWRTZXJ2aWNlVXVpZHM7XG5cbiAgICBzZXJ2aWNlLmVtaXQoJ2luY2x1ZGVkU2VydmljZXNEaXNjb3ZlcicsIGluY2x1ZGVkU2VydmljZVV1aWRzKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLndhcm4oJ25vYmxlOiB1bmtub3duIHBlcmlwaGVyYWwgJyArIHBlcmlwaGVyYWxVdWlkICsgJywgJyArIHNlcnZpY2VVdWlkICsgJyBpbmNsdWRlZCBzZXJ2aWNlcyBkaXNjb3ZlciEnKTtcbiAgfVxufTtcblxuTm9ibGUucHJvdG90eXBlLmRpc2NvdmVyQ2hhcmFjdGVyaXN0aWNzID0gZnVuY3Rpb24ocGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWRzKSB7XG4gIHRoaXMuX2JpbmRpbmdzLmRpc2NvdmVyQ2hhcmFjdGVyaXN0aWNzKHBlcmlwaGVyYWxVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkcyk7XG59O1xuXG5Ob2JsZS5wcm90b3R5cGUub25DaGFyYWN0ZXJpc3RpY3NEaXNjb3ZlciA9IGZ1bmN0aW9uKHBlcmlwaGVyYWxVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNzKSB7XG4gIHZhciBzZXJ2aWNlID0gdGhpcy5fc2VydmljZXNbcGVyaXBoZXJhbFV1aWRdW3NlcnZpY2VVdWlkXTtcblxuICBpZiAoc2VydmljZSkge1xuICAgIHZhciBjaGFyYWN0ZXJpc3RpY3NfID0gW107XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYXJhY3RlcmlzdGljcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGNoYXJhY3RlcmlzdGljVXVpZCA9IGNoYXJhY3RlcmlzdGljc1tpXS51dWlkO1xuXG4gICAgICB2YXIgY2hhcmFjdGVyaXN0aWMgPSBuZXcgQ2hhcmFjdGVyaXN0aWMoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBlcmlwaGVyYWxVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXJ2aWNlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hhcmFjdGVyaXN0aWNVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFyYWN0ZXJpc3RpY3NbaV0ucHJvcGVydGllc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG5cbiAgICAgIHRoaXMuX2NoYXJhY3RlcmlzdGljc1twZXJpcGhlcmFsVXVpZF1bc2VydmljZVV1aWRdW2NoYXJhY3RlcmlzdGljVXVpZF0gPSBjaGFyYWN0ZXJpc3RpYztcbiAgICAgIHRoaXMuX2Rlc2NyaXB0b3JzW3BlcmlwaGVyYWxVdWlkXVtzZXJ2aWNlVXVpZF1bY2hhcmFjdGVyaXN0aWNVdWlkXSA9IHt9O1xuXG4gICAgICBjaGFyYWN0ZXJpc3RpY3NfLnB1c2goY2hhcmFjdGVyaXN0aWMpO1xuICAgIH1cblxuICAgIHNlcnZpY2UuY2hhcmFjdGVyaXN0aWNzID0gY2hhcmFjdGVyaXN0aWNzXztcblxuICAgIHNlcnZpY2UuZW1pdCgnY2hhcmFjdGVyaXN0aWNzRGlzY292ZXInLCBjaGFyYWN0ZXJpc3RpY3NfKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLndhcm4oJ25vYmxlOiB1bmtub3duIHBlcmlwaGVyYWwgJyArIHBlcmlwaGVyYWxVdWlkICsgJywgJyArIHNlcnZpY2VVdWlkICsgJyBjaGFyYWN0ZXJpc3RpY3MgZGlzY292ZXIhJyk7XG4gIH1cbn07XG5cbk5vYmxlLnByb3RvdHlwZS5yZWFkID0gZnVuY3Rpb24ocGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQpIHtcbiAgIHRoaXMuX2JpbmRpbmdzLnJlYWQocGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQpO1xufTtcblxuTm9ibGUucHJvdG90eXBlLm9uUmVhZCA9IGZ1bmN0aW9uKHBlcmlwaGVyYWxVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBkYXRhLCBpc05vdGlmaWNhdGlvbikge1xuICB2YXIgY2hhcmFjdGVyaXN0aWMgPSB0aGlzLl9jaGFyYWN0ZXJpc3RpY3NbcGVyaXBoZXJhbFV1aWRdW3NlcnZpY2VVdWlkXVtjaGFyYWN0ZXJpc3RpY1V1aWRdO1xuXG4gIGlmIChjaGFyYWN0ZXJpc3RpYykge1xuICAgIGNoYXJhY3RlcmlzdGljLmVtaXQoJ3JlYWQnLCBkYXRhLCBpc05vdGlmaWNhdGlvbik7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS53YXJuKCdub2JsZTogdW5rbm93biBwZXJpcGhlcmFsICcgKyBwZXJpcGhlcmFsVXVpZCArICcsICcgKyBzZXJ2aWNlVXVpZCArICcsICcgKyBjaGFyYWN0ZXJpc3RpY1V1aWQgKyAnIHJlYWQhJyk7XG4gIH1cbn07XG5cbk5vYmxlLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uKHBlcmlwaGVyYWxVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBkYXRhLCB3aXRob3V0UmVzcG9uc2UpIHtcbiAgIHRoaXMuX2JpbmRpbmdzLndyaXRlKHBlcmlwaGVyYWxVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBkYXRhLCB3aXRob3V0UmVzcG9uc2UpO1xufTtcblxuTm9ibGUucHJvdG90eXBlLm9uV3JpdGUgPSBmdW5jdGlvbihwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCkge1xuICB2YXIgY2hhcmFjdGVyaXN0aWMgPSB0aGlzLl9jaGFyYWN0ZXJpc3RpY3NbcGVyaXBoZXJhbFV1aWRdW3NlcnZpY2VVdWlkXVtjaGFyYWN0ZXJpc3RpY1V1aWRdO1xuXG4gIGlmIChjaGFyYWN0ZXJpc3RpYykge1xuICAgIGNoYXJhY3RlcmlzdGljLmVtaXQoJ3dyaXRlJyk7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS53YXJuKCdub2JsZTogdW5rbm93biBwZXJpcGhlcmFsICcgKyBwZXJpcGhlcmFsVXVpZCArICcsICcgKyBzZXJ2aWNlVXVpZCArICcsICcgKyBjaGFyYWN0ZXJpc3RpY1V1aWQgKyAnIHdyaXRlIScpO1xuICB9XG59O1xuXG5Ob2JsZS5wcm90b3R5cGUuYnJvYWRjYXN0ID0gZnVuY3Rpb24ocGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIGJyb2FkY2FzdCkge1xuICAgdGhpcy5fYmluZGluZ3MuYnJvYWRjYXN0KHBlcmlwaGVyYWxVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkLCBicm9hZGNhc3QpO1xufTtcblxuTm9ibGUucHJvdG90eXBlLm9uQnJvYWRjYXN0ID0gZnVuY3Rpb24ocGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIHN0YXRlKSB7XG4gIHZhciBjaGFyYWN0ZXJpc3RpYyA9IHRoaXMuX2NoYXJhY3RlcmlzdGljc1twZXJpcGhlcmFsVXVpZF1bc2VydmljZVV1aWRdW2NoYXJhY3RlcmlzdGljVXVpZF07XG5cbiAgaWYgKGNoYXJhY3RlcmlzdGljKSB7XG4gICAgY2hhcmFjdGVyaXN0aWMuZW1pdCgnYnJvYWRjYXN0Jywgc3RhdGUpO1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUud2Fybignbm9ibGU6IHVua25vd24gcGVyaXBoZXJhbCAnICsgcGVyaXBoZXJhbFV1aWQgKyAnLCAnICsgc2VydmljZVV1aWQgKyAnLCAnICsgY2hhcmFjdGVyaXN0aWNVdWlkICsgJyBicm9hZGNhc3QhJyk7XG4gIH1cbn07XG5cbk5vYmxlLnByb3RvdHlwZS5ub3RpZnkgPSBmdW5jdGlvbihwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgbm90aWZ5KSB7XG4gICB0aGlzLl9iaW5kaW5ncy5ub3RpZnkocGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIG5vdGlmeSk7XG59O1xuXG5Ob2JsZS5wcm90b3R5cGUub25Ob3RpZnkgPSBmdW5jdGlvbihwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgc3RhdGUpIHtcbiAgdmFyIGNoYXJhY3RlcmlzdGljID0gdGhpcy5fY2hhcmFjdGVyaXN0aWNzW3BlcmlwaGVyYWxVdWlkXVtzZXJ2aWNlVXVpZF1bY2hhcmFjdGVyaXN0aWNVdWlkXTtcblxuICBpZiAoY2hhcmFjdGVyaXN0aWMpIHtcbiAgICBjaGFyYWN0ZXJpc3RpYy5lbWl0KCdub3RpZnknLCBzdGF0ZSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS53YXJuKCdub2JsZTogdW5rbm93biBwZXJpcGhlcmFsICcgKyBwZXJpcGhlcmFsVXVpZCArICcsICcgKyBzZXJ2aWNlVXVpZCArICcsICcgKyBjaGFyYWN0ZXJpc3RpY1V1aWQgKyAnIG5vdGlmeSEnKTtcbiAgfVxufTtcblxuTm9ibGUucHJvdG90eXBlLmRpc2NvdmVyRGVzY3JpcHRvcnMgPSBmdW5jdGlvbihwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCkge1xuICB0aGlzLl9iaW5kaW5ncy5kaXNjb3ZlckRlc2NyaXB0b3JzKHBlcmlwaGVyYWxVdWlkLCBzZXJ2aWNlVXVpZCwgY2hhcmFjdGVyaXN0aWNVdWlkKTtcbn07XG5cbk5vYmxlLnByb3RvdHlwZS5vbkRlc2NyaXB0b3JzRGlzY292ZXIgPSBmdW5jdGlvbihwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgZGVzY3JpcHRvcnMpIHtcbiAgdmFyIGNoYXJhY3RlcmlzdGljID0gdGhpcy5fY2hhcmFjdGVyaXN0aWNzW3BlcmlwaGVyYWxVdWlkXVtzZXJ2aWNlVXVpZF1bY2hhcmFjdGVyaXN0aWNVdWlkXTtcblxuICBpZiAoY2hhcmFjdGVyaXN0aWMpIHtcbiAgICB2YXIgZGVzY3JpcHRvcnNfID0gW107XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRlc2NyaXB0b3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZGVzY3JpcHRvclV1aWQgPSBkZXNjcmlwdG9yc1tpXTtcblxuICAgICAgdmFyIGRlc2NyaXB0b3IgPSBuZXcgRGVzY3JpcHRvcihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBlcmlwaGVyYWxVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZpY2VVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYXJhY3RlcmlzdGljVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdG9yVXVpZFxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcblxuICAgICAgdGhpcy5fZGVzY3JpcHRvcnNbcGVyaXBoZXJhbFV1aWRdW3NlcnZpY2VVdWlkXVtjaGFyYWN0ZXJpc3RpY1V1aWRdW2Rlc2NyaXB0b3JVdWlkXSA9IGRlc2NyaXB0b3I7XG5cbiAgICAgIGRlc2NyaXB0b3JzXy5wdXNoKGRlc2NyaXB0b3IpO1xuICAgIH1cblxuICAgIGNoYXJhY3RlcmlzdGljLmRlc2NyaXB0b3JzID0gZGVzY3JpcHRvcnNfO1xuXG4gICAgY2hhcmFjdGVyaXN0aWMuZW1pdCgnZGVzY3JpcHRvcnNEaXNjb3ZlcicsIGRlc2NyaXB0b3JzXyk7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS53YXJuKCdub2JsZTogdW5rbm93biBwZXJpcGhlcmFsICcgKyBwZXJpcGhlcmFsVXVpZCArICcsICcgKyBzZXJ2aWNlVXVpZCArICcsICcgKyBjaGFyYWN0ZXJpc3RpY1V1aWQgKyAnIGRlc2NyaXB0b3JzIGRpc2NvdmVyIScpO1xuICB9XG59O1xuXG5Ob2JsZS5wcm90b3R5cGUucmVhZFZhbHVlID0gZnVuY3Rpb24ocGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIGRlc2NyaXB0b3JVdWlkKSB7XG4gIHRoaXMuX2JpbmRpbmdzLnJlYWRWYWx1ZShwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgZGVzY3JpcHRvclV1aWQpO1xufTtcblxuTm9ibGUucHJvdG90eXBlLm9uVmFsdWVSZWFkID0gZnVuY3Rpb24ocGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIGRlc2NyaXB0b3JVdWlkLCBkYXRhKSB7XG4gIHZhciBkZXNjcmlwdG9yID0gdGhpcy5fZGVzY3JpcHRvcnNbcGVyaXBoZXJhbFV1aWRdW3NlcnZpY2VVdWlkXVtjaGFyYWN0ZXJpc3RpY1V1aWRdW2Rlc2NyaXB0b3JVdWlkXTtcblxuICBpZiAoZGVzY3JpcHRvcikge1xuICAgIGRlc2NyaXB0b3IuZW1pdCgndmFsdWVSZWFkJywgZGF0YSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS53YXJuKCdub2JsZTogdW5rbm93biBwZXJpcGhlcmFsICcgKyBwZXJpcGhlcmFsVXVpZCArICcsICcgKyBzZXJ2aWNlVXVpZCArICcsICcgKyBjaGFyYWN0ZXJpc3RpY1V1aWQgKyAnLCAnICsgZGVzY3JpcHRvclV1aWQgKyAnIHZhbHVlIHJlYWQhJyk7XG4gIH1cbn07XG5cbk5vYmxlLnByb3RvdHlwZS53cml0ZVZhbHVlID0gZnVuY3Rpb24ocGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIGRlc2NyaXB0b3JVdWlkLCBkYXRhKSB7XG4gIHRoaXMuX2JpbmRpbmdzLndyaXRlVmFsdWUocGVyaXBoZXJhbFV1aWQsIHNlcnZpY2VVdWlkLCBjaGFyYWN0ZXJpc3RpY1V1aWQsIGRlc2NyaXB0b3JVdWlkLCBkYXRhKTtcbn07XG5cbk5vYmxlLnByb3RvdHlwZS5vblZhbHVlV3JpdGUgPSBmdW5jdGlvbihwZXJpcGhlcmFsVXVpZCwgc2VydmljZVV1aWQsIGNoYXJhY3RlcmlzdGljVXVpZCwgZGVzY3JpcHRvclV1aWQpIHtcbiAgdmFyIGRlc2NyaXB0b3IgPSB0aGlzLl9kZXNjcmlwdG9yc1twZXJpcGhlcmFsVXVpZF1bc2VydmljZVV1aWRdW2NoYXJhY3RlcmlzdGljVXVpZF1bZGVzY3JpcHRvclV1aWRdO1xuXG4gIGlmIChkZXNjcmlwdG9yKSB7XG4gICAgZGVzY3JpcHRvci5lbWl0KCd2YWx1ZVdyaXRlJyk7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS53YXJuKCdub2JsZTogdW5rbm93biBwZXJpcGhlcmFsICcgKyBwZXJpcGhlcmFsVXVpZCArICcsICcgKyBzZXJ2aWNlVXVpZCArICcsICcgKyBjaGFyYWN0ZXJpc3RpY1V1aWQgKyAnLCAnICsgZGVzY3JpcHRvclV1aWQgKyAnIHZhbHVlIHdyaXRlIScpO1xuICB9XG59O1xuXG5Ob2JsZS5wcm90b3R5cGUucmVhZEhhbmRsZSA9IGZ1bmN0aW9uKHBlcmlwaGVyYWxVdWlkLCBoYW5kbGUpIHtcbiAgdGhpcy5fYmluZGluZ3MucmVhZEhhbmRsZShwZXJpcGhlcmFsVXVpZCwgaGFuZGxlKTtcbn07XG5cbk5vYmxlLnByb3RvdHlwZS5vbkhhbmRsZVJlYWQgPSBmdW5jdGlvbihwZXJpcGhlcmFsVXVpZCwgaGFuZGxlLCBkYXRhKSB7XG4gIHZhciBwZXJpcGhlcmFsID0gdGhpcy5fcGVyaXBoZXJhbHNbcGVyaXBoZXJhbFV1aWRdO1xuXG4gIGlmIChwZXJpcGhlcmFsKSB7XG4gICAgcGVyaXBoZXJhbC5lbWl0KCdoYW5kbGVSZWFkJyArIGhhbmRsZSwgZGF0YSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS53YXJuKCdub2JsZTogdW5rbm93biBwZXJpcGhlcmFsICcgKyBwZXJpcGhlcmFsVXVpZCArICcgaGFuZGxlIHJlYWQhJyk7XG4gIH1cbn07XG5cbk5vYmxlLnByb3RvdHlwZS53cml0ZUhhbmRsZSA9IGZ1bmN0aW9uKHBlcmlwaGVyYWxVdWlkLCBoYW5kbGUsIGRhdGEsIHdpdGhvdXRSZXNwb25zZSkge1xuICB0aGlzLl9iaW5kaW5ncy53cml0ZUhhbmRsZShwZXJpcGhlcmFsVXVpZCwgaGFuZGxlLCBkYXRhLCB3aXRob3V0UmVzcG9uc2UpO1xufTtcblxuTm9ibGUucHJvdG90eXBlLm9uSGFuZGxlV3JpdGUgPSBmdW5jdGlvbihwZXJpcGhlcmFsVXVpZCwgaGFuZGxlKSB7XG4gIHZhciBwZXJpcGhlcmFsID0gdGhpcy5fcGVyaXBoZXJhbHNbcGVyaXBoZXJhbFV1aWRdO1xuXG4gIGlmIChwZXJpcGhlcmFsKSB7XG4gICAgcGVyaXBoZXJhbC5lbWl0KCdoYW5kbGVXcml0ZScgKyBoYW5kbGUpO1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUud2Fybignbm9ibGU6IHVua25vd24gcGVyaXBoZXJhbCAnICsgcGVyaXBoZXJhbFV1aWQgKyAnIGhhbmRsZSB3cml0ZSEnKTtcbiAgfVxufTtcblxuTm9ibGUucHJvdG90eXBlLm9uSGFuZGxlTm90aWZ5ID0gZnVuY3Rpb24ocGVyaXBoZXJhbFV1aWQsIGhhbmRsZSwgZGF0YSkge1xuICB2YXIgcGVyaXBoZXJhbCA9IHRoaXMuX3BlcmlwaGVyYWxzW3BlcmlwaGVyYWxVdWlkXTtcblxuICBpZiAocGVyaXBoZXJhbCkge1xuICAgIHBlcmlwaGVyYWwuZW1pdCgnaGFuZGxlTm90aWZ5JywgaGFuZGxlLCBkYXRhKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLndhcm4oJ25vYmxlOiB1bmtub3duIHBlcmlwaGVyYWwgJyArIHBlcmlwaGVyYWxVdWlkICsgJyBoYW5kbGUgbm90aWZ5IScpO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE5vYmxlO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIklyWFVzdVwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL25vZGVfbW9kdWxlcy9ub2JsZS9saWIvbm9ibGUuanNcIixcIi9ub2RlX21vZHVsZXMvbm9ibGUvbGliXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLypqc2hpbnQgbG9vcGZ1bmM6IHRydWUgKi9cbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJykoJ3BlcmlwaGVyYWwnKTtcblxudmFyIGV2ZW50cyA9IHJlcXVpcmUoJ2V2ZW50cycpO1xudmFyIHV0aWwgPSByZXF1aXJlKCd1dGlsJyk7XG5cbmZ1bmN0aW9uIFBlcmlwaGVyYWwobm9ibGUsIHV1aWQsIGFkdmVydGlzZW1lbnQsIHJzc2kpIHtcbiAgdGhpcy5fbm9ibGUgPSBub2JsZTtcblxuICB0aGlzLnV1aWQgPSB1dWlkO1xuICB0aGlzLmFkdmVydGlzZW1lbnQgPSBhZHZlcnRpc2VtZW50O1xuICB0aGlzLnJzc2kgPSByc3NpO1xuICB0aGlzLnNlcnZpY2VzID0gbnVsbDtcbiAgdGhpcy5zdGF0ZSA9ICdkaXNjb25uZWN0ZWQnO1xufVxuXG51dGlsLmluaGVyaXRzKFBlcmlwaGVyYWwsIGV2ZW50cy5FdmVudEVtaXR0ZXIpO1xuXG5QZXJpcGhlcmFsLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgIHV1aWQ6IHRoaXMudXVpZCxcbiAgICBhZHZlcnRpc2VtZW50OiB0aGlzLmFkdmVydGlzZW1lbnQsXG4gICAgcnNzaTogdGhpcy5yc3NpLFxuICAgIHN0YXRlOiB0aGlzLnN0YXRlXG4gIH0pO1xufTtcblxuUGVyaXBoZXJhbC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIGlmIChjYWxsYmFjaykge1xuICAgIHRoaXMub25jZSgnY29ubmVjdCcsIGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICBjYWxsYmFjayhlcnJvcik7XG4gICAgfSk7XG4gIH1cbiAgXG4gIGlmICh0aGlzLnN0YXRlID09PSAnY29ubmVjdGVkJykge1xuICAgIHRoaXMuZW1pdCgnY29ubmVjdCcsIG5ldyBFcnJvcignUGVyaXBoZXJhbCBhbHJlYWR5IGNvbm5lY3RlZCcpKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnN0YXRlID0gJ2Nvbm5lY3RpbmcnO1xuICAgIHRoaXMuX25vYmxlLmNvbm5lY3QodGhpcy51dWlkKTtcbiAgfVxufTtcblxuUGVyaXBoZXJhbC5wcm90b3R5cGUuZGlzY29ubmVjdCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIGlmIChjYWxsYmFjaykge1xuICAgIHRoaXMub25jZSgnZGlzY29ubmVjdCcsIGZ1bmN0aW9uKCkge1xuICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgfSk7XG4gIH1cbiAgdGhpcy5zdGF0ZSA9ICdkaXNjb25uZWN0aW5nJztcbiAgdGhpcy5fbm9ibGUuZGlzY29ubmVjdCh0aGlzLnV1aWQpO1xufTtcblxuUGVyaXBoZXJhbC5wcm90b3R5cGUudXBkYXRlUnNzaSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIGlmIChjYWxsYmFjaykge1xuICAgIHRoaXMub25jZSgncnNzaVVwZGF0ZScsIGZ1bmN0aW9uKHJzc2kpIHtcbiAgICAgIGNhbGxiYWNrKG51bGwsIHJzc2kpO1xuICAgIH0pO1xuICB9XG5cbiAgdGhpcy5fbm9ibGUudXBkYXRlUnNzaSh0aGlzLnV1aWQpO1xufTtcblxuUGVyaXBoZXJhbC5wcm90b3R5cGUuZGlzY292ZXJTZXJ2aWNlcyA9IGZ1bmN0aW9uKHV1aWRzLCBjYWxsYmFjaykge1xuICBpZiAoY2FsbGJhY2spIHtcbiAgICB0aGlzLm9uY2UoJ3NlcnZpY2VzRGlzY292ZXInLCBmdW5jdGlvbihzZXJ2aWNlcykge1xuICAgICAgY2FsbGJhY2sobnVsbCwgc2VydmljZXMpO1xuICAgIH0pO1xuICB9XG5cbiAgdGhpcy5fbm9ibGUuZGlzY292ZXJTZXJ2aWNlcyh0aGlzLnV1aWQsIHV1aWRzKTtcbn07XG5cblBlcmlwaGVyYWwucHJvdG90eXBlLmRpc2NvdmVyU29tZVNlcnZpY2VzQW5kQ2hhcmFjdGVyaXN0aWNzID0gZnVuY3Rpb24oc2VydmljZVV1aWRzLCBjaGFyYWN0ZXJpc3RpY3NVdWlkcywgY2FsbGJhY2spIHtcbiAgdGhpcy5kaXNjb3ZlclNlcnZpY2VzKHNlcnZpY2VVdWlkcywgZnVuY3Rpb24oZXJyLCBzZXJ2aWNlcykge1xuICAgIHZhciBudW1EaXNjb3ZlcmVkID0gMDtcbiAgICB2YXIgYWxsQ2hhcmFjdGVyaXN0aWNzID0gW107XG5cbiAgICBmb3IgKHZhciBpIGluIHNlcnZpY2VzKSB7XG4gICAgICB2YXIgc2VydmljZSA9IHNlcnZpY2VzW2ldO1xuXG4gICAgICBzZXJ2aWNlLmRpc2NvdmVyQ2hhcmFjdGVyaXN0aWNzKGNoYXJhY3RlcmlzdGljc1V1aWRzLCBmdW5jdGlvbihlcnJvciwgY2hhcmFjdGVyaXN0aWNzKSB7XG4gICAgICAgIG51bURpc2NvdmVyZWQrKztcblxuICAgICAgICBpZiAoZXJyb3IgPT09IG51bGwpIHtcbiAgICAgICAgICBmb3IgKHZhciBqIGluIGNoYXJhY3RlcmlzdGljcykge1xuICAgICAgICAgICAgdmFyIGNoYXJhY3RlcmlzdGljID0gY2hhcmFjdGVyaXN0aWNzW2pdO1xuXG4gICAgICAgICAgICBhbGxDaGFyYWN0ZXJpc3RpY3MucHVzaChjaGFyYWN0ZXJpc3RpYyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG51bURpc2NvdmVyZWQgPT09IHNlcnZpY2VzLmxlbmd0aCkge1xuICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgc2VydmljZXMsIGFsbENoYXJhY3RlcmlzdGljcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cbiAgfS5iaW5kKHRoaXMpKTtcbn07XG5cblBlcmlwaGVyYWwucHJvdG90eXBlLmRpc2NvdmVyQWxsU2VydmljZXNBbmRDaGFyYWN0ZXJpc3RpY3MgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICB0aGlzLmRpc2NvdmVyU29tZVNlcnZpY2VzQW5kQ2hhcmFjdGVyaXN0aWNzKFtdLCBbXSwgY2FsbGJhY2spO1xufTtcblxuUGVyaXBoZXJhbC5wcm90b3R5cGUucmVhZEhhbmRsZSA9IGZ1bmN0aW9uKGhhbmRsZSwgY2FsbGJhY2spIHtcbiAgaWYgKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5vbmNlKCdoYW5kbGVSZWFkJyArIGhhbmRsZSwgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgY2FsbGJhY2sobnVsbCwgZGF0YSk7XG4gICAgfSk7XG4gIH1cblxuICB0aGlzLl9ub2JsZS5yZWFkSGFuZGxlKHRoaXMudXVpZCwgaGFuZGxlKTtcbn07XG5cblBlcmlwaGVyYWwucHJvdG90eXBlLndyaXRlSGFuZGxlID0gZnVuY3Rpb24oaGFuZGxlLCBkYXRhLCB3aXRob3V0UmVzcG9uc2UsIGNhbGxiYWNrKSB7XG4gIGlmICghKGRhdGEgaW5zdGFuY2VvZiBCdWZmZXIpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdkYXRhIG11c3QgYmUgYSBCdWZmZXInKTtcbiAgfVxuICBcbiAgaWYgKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5vbmNlKCdoYW5kbGVXcml0ZScgKyBoYW5kbGUsIGZ1bmN0aW9uKCkge1xuICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgfSk7XG4gIH1cblxuICB0aGlzLl9ub2JsZS53cml0ZUhhbmRsZSh0aGlzLnV1aWQsIGhhbmRsZSwgZGF0YSwgd2l0aG91dFJlc3BvbnNlKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUGVyaXBoZXJhbDtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJJclhVc3VcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9ub2RlX21vZHVsZXMvbm9ibGUvbGliL3BlcmlwaGVyYWwuanNcIixcIi9ub2RlX21vZHVsZXMvbm9ibGUvbGliXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIGRlYnVnID0gcmVxdWlyZSgnZGVidWcnKSgnc2VydmljZScpO1xuXG52YXIgZXZlbnRzID0gcmVxdWlyZSgnZXZlbnRzJyk7XG52YXIgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKTtcblxudmFyIHNlcnZpY2VzID0gcmVxdWlyZSgnLi9zZXJ2aWNlcy5qc29uJyk7XG5cbmZ1bmN0aW9uIFNlcnZpY2Uobm9ibGUsIHBlcmlwaGVyYWxVdWlkLCB1dWlkKSB7XG4gIHRoaXMuX25vYmxlID0gbm9ibGU7XG4gIHRoaXMuX3BlcmlwaGVyYWxVdWlkID0gcGVyaXBoZXJhbFV1aWQ7XG5cbiAgdGhpcy51dWlkID0gdXVpZDtcbiAgdGhpcy5uYW1lID0gbnVsbDtcbiAgdGhpcy50eXBlID0gbnVsbDtcbiAgdGhpcy5pbmNsdWRlZFNlcnZpY2VVdWlkcyA9IG51bGw7XG4gIHRoaXMuY2hhcmFjdGVyaXN0aWNzID0gbnVsbDtcblxuICB2YXIgc2VydmljZSA9IHNlcnZpY2VzW3V1aWRdO1xuICBpZiAoc2VydmljZSkge1xuICAgIHRoaXMubmFtZSA9IHNlcnZpY2UubmFtZTtcbiAgICB0aGlzLnR5cGUgPSBzZXJ2aWNlLnR5cGU7XG4gIH1cbn1cblxudXRpbC5pbmhlcml0cyhTZXJ2aWNlLCBldmVudHMuRXZlbnRFbWl0dGVyKTtcblxuU2VydmljZS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICB1dWlkOiB0aGlzLnV1aWQsXG4gICAgbmFtZTogdGhpcy5uYW1lLFxuICAgIHR5cGU6IHRoaXMudHlwZSxcbiAgICBpbmNsdWRlZFNlcnZpY2VVdWlkczogdGhpcy5pbmNsdWRlZFNlcnZpY2VVdWlkc1xuICB9KTtcbn07XG5cblNlcnZpY2UucHJvdG90eXBlLmRpc2NvdmVySW5jbHVkZWRTZXJ2aWNlcyA9IGZ1bmN0aW9uKHNlcnZpY2VVdWlkcywgY2FsbGJhY2spIHtcbiAgaWYgKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5vbmNlKCdpbmNsdWRlZFNlcnZpY2VzRGlzY292ZXInLCBmdW5jdGlvbihpbmNsdWRlZFNlcnZpY2VVdWlkcykge1xuICAgICAgY2FsbGJhY2sobnVsbCwgaW5jbHVkZWRTZXJ2aWNlVXVpZHMpO1xuICAgIH0pO1xuICB9XG5cbiAgdGhpcy5fbm9ibGUuZGlzY292ZXJJbmNsdWRlZFNlcnZpY2VzKFxuICAgIHRoaXMuX3BlcmlwaGVyYWxVdWlkLFxuICAgIHRoaXMudXVpZCxcbiAgICBzZXJ2aWNlVXVpZHNcbiAgKTtcbn07XG5cblNlcnZpY2UucHJvdG90eXBlLmRpc2NvdmVyQ2hhcmFjdGVyaXN0aWNzID0gZnVuY3Rpb24oY2hhcmFjdGVyaXN0aWNVdWlkcywgY2FsbGJhY2spIHtcbiAgaWYgKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5vbmNlKCdjaGFyYWN0ZXJpc3RpY3NEaXNjb3ZlcicsIGZ1bmN0aW9uKGNoYXJhY3RlcmlzdGljcykge1xuICAgICAgY2FsbGJhY2sobnVsbCwgY2hhcmFjdGVyaXN0aWNzKTtcbiAgICB9KTtcbiAgfVxuXG4gIHRoaXMuX25vYmxlLmRpc2NvdmVyQ2hhcmFjdGVyaXN0aWNzKFxuICAgIHRoaXMuX3BlcmlwaGVyYWxVdWlkLFxuICAgIHRoaXMudXVpZCxcbiAgICBjaGFyYWN0ZXJpc3RpY1V1aWRzXG4gICk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNlcnZpY2U7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiSXJYVXN1XCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbm9kZV9tb2R1bGVzL25vYmxlL2xpYi9zZXJ2aWNlLmpzXCIsXCIvbm9kZV9tb2R1bGVzL25vYmxlL2xpYlwiKSIsIm1vZHVsZS5leHBvcnRzPXtcbiAgICBcIjE4MDBcIiA6IHsgXCJuYW1lXCIgOiBcIkdlbmVyaWMgQWNjZXNzXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLnNlcnZpY2UuZ2VuZXJpY19hY2Nlc3NcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjE4MDFcIiA6IHsgXCJuYW1lXCIgOiBcIkdlbmVyaWMgQXR0cmlidXRlXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLnNlcnZpY2UuZ2VuZXJpY19hdHRyaWJ1dGVcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjE4MDJcIiA6IHsgXCJuYW1lXCIgOiBcIkltbWVkaWF0ZSBBbGVydFwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5zZXJ2aWNlLmltbWVkaWF0ZV9hbGVydFwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMTgwM1wiIDogeyBcIm5hbWVcIiA6IFwiTGluayBMb3NzXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLnNlcnZpY2UubGlua19sb3NzXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIxODA0XCIgOiB7IFwibmFtZVwiIDogXCJUeCBQb3dlclwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5zZXJ2aWNlLnR4X3Bvd2VyXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIxODA1XCIgOiB7IFwibmFtZVwiIDogXCJDdXJyZW50IFRpbWUgU2VydmljZVwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5zZXJ2aWNlLmN1cnJlbnRfdGltZVwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMTgwNlwiIDogeyBcIm5hbWVcIiA6IFwiUmVmZXJlbmNlIFRpbWUgVXBkYXRlIFNlcnZpY2VcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguc2VydmljZS5yZWZlcmVuY2VfdGltZV91cGRhdGVcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjE4MDdcIiA6IHsgXCJuYW1lXCIgOiBcIk5leHQgRFNUIENoYW5nZSBTZXJ2aWNlXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLnNlcnZpY2UubmV4dF9kc3RfY2hhbmdlXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIxODA4XCIgOiB7IFwibmFtZVwiIDogXCJHbHVjb3NlXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLnNlcnZpY2UuZ2x1Y29zZVwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMTgwOVwiIDogeyBcIm5hbWVcIiA6IFwiSGVhbHRoIFRoZXJtb21ldGVyXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLnNlcnZpY2UuaGVhbHRoX3RoZXJtb21ldGVyXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIxODBhXCIgOiB7IFwibmFtZVwiIDogXCJEZXZpY2UgSW5mb3JtYXRpb25cIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguc2VydmljZS5kZXZpY2VfaW5mb3JtYXRpb25cIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjE4MGRcIiA6IHsgXCJuYW1lXCIgOiBcIkhlYXJ0IFJhdGVcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguc2VydmljZS5oZWFydF9yYXRlXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIxODBlXCIgOiB7IFwibmFtZVwiIDogXCJQaG9uZSBBbGVydCBTdGF0dXMgU2VydmljZVwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5zZXJ2aWNlLnBob25lX2FsZXJ0X3NlcnZpY2VcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjE4MGZcIiA6IHsgXCJuYW1lXCIgOiBcIkJhdHRlcnkgU2VydmljZVwiXG4gICAgICAgICAgICAgLCBcInR5cGVcIiA6IFwib3JnLmJsdWV0b290aC5zZXJ2aWNlLmJhdHRlcnlfc2VydmljZVwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMTgxMFwiIDogeyBcIm5hbWVcIiA6IFwiQmxvb2QgUHJlc3N1cmVcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguc2VydmljZS5ibG9vZF9wcmVzc3VlclwiXG4gICAgICAgICAgICAgfVxuICAsIFwiMTgxMVwiIDogeyBcIm5hbWVcIiA6IFwiQWxlcnQgTm90aWZpY2F0aW9uIFNlcnZpY2VcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguc2VydmljZS5hbGVydF9ub3RpZmljYXRpb25cIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjE4MTJcIiA6IHsgXCJuYW1lXCIgOiBcIkh1bWFuIEludGVyZmFjZSBEZXZpY2VcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguc2VydmljZS5odW1hbl9pbnRlcmZhY2VfZGV2aWNlXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIxODEzXCIgOiB7IFwibmFtZVwiIDogXCJTY2FuIFBhcmFtZXRlcnNcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguc2VydmljZS5zY2FuX3BhcmFtZXRlcnNcIlxuICAgICAgICAgICAgIH1cbiAgLCBcIjE4MTRcIiA6IHsgXCJuYW1lXCIgOiBcIlJ1bm5pbmcgU3BlZWQgYW5kIENhZGVuY2VcIlxuICAgICAgICAgICAgICwgXCJ0eXBlXCIgOiBcIm9yZy5ibHVldG9vdGguc2VydmljZS5ydW5uaW5nX3NwZWVkX2FuZF9jYWRlbmNlXCJcbiAgICAgICAgICAgICB9XG4gICwgXCIxODE1XCIgOiB7IFwibmFtZVwiIDogXCJDeWNsaW5nIFNwZWVkIGFuZCBDYWRlbmNlXCJcbiAgICAgICAgICAgICAsIFwidHlwZVwiIDogXCJvcmcuYmx1ZXRvb3RoLnNlcnZpY2UuY3ljbGluZ19zcGVlZF9hbmRfY2FkZW5jZVwiXG4gICAgICAgICAgICAgfVxufSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcblxuLyoqXG4gKiBFeHBvc2UgYGRlYnVnKClgIGFzIHRoZSBtb2R1bGUuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBkZWJ1ZztcblxuLyoqXG4gKiBDcmVhdGUgYSBkZWJ1Z2dlciB3aXRoIHRoZSBnaXZlbiBgbmFtZWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge1R5cGV9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRlYnVnKG5hbWUpIHtcbiAgaWYgKCFkZWJ1Zy5lbmFibGVkKG5hbWUpKSByZXR1cm4gZnVuY3Rpb24oKXt9O1xuXG4gIHJldHVybiBmdW5jdGlvbihmbXQpe1xuICAgIGZtdCA9IGNvZXJjZShmbXQpO1xuXG4gICAgdmFyIGN1cnIgPSBuZXcgRGF0ZTtcbiAgICB2YXIgbXMgPSBjdXJyIC0gKGRlYnVnW25hbWVdIHx8IGN1cnIpO1xuICAgIGRlYnVnW25hbWVdID0gY3VycjtcblxuICAgIGZtdCA9IG5hbWVcbiAgICAgICsgJyAnXG4gICAgICArIGZtdFxuICAgICAgKyAnICsnICsgZGVidWcuaHVtYW5pemUobXMpO1xuXG4gICAgLy8gVGhpcyBoYWNrZXJ5IGlzIHJlcXVpcmVkIGZvciBJRThcbiAgICAvLyB3aGVyZSBgY29uc29sZS5sb2dgIGRvZXNuJ3QgaGF2ZSAnYXBwbHknXG4gICAgd2luZG93LmNvbnNvbGVcbiAgICAgICYmIGNvbnNvbGUubG9nXG4gICAgICAmJiBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbChjb25zb2xlLmxvZywgY29uc29sZSwgYXJndW1lbnRzKTtcbiAgfVxufVxuXG4vKipcbiAqIFRoZSBjdXJyZW50bHkgYWN0aXZlIGRlYnVnIG1vZGUgbmFtZXMuXG4gKi9cblxuZGVidWcubmFtZXMgPSBbXTtcbmRlYnVnLnNraXBzID0gW107XG5cbi8qKlxuICogRW5hYmxlcyBhIGRlYnVnIG1vZGUgYnkgbmFtZS4gVGhpcyBjYW4gaW5jbHVkZSBtb2Rlc1xuICogc2VwYXJhdGVkIGJ5IGEgY29sb24gYW5kIHdpbGRjYXJkcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5kZWJ1Zy5lbmFibGUgPSBmdW5jdGlvbihuYW1lKSB7XG4gIHRyeSB7XG4gICAgbG9jYWxTdG9yYWdlLmRlYnVnID0gbmFtZTtcbiAgfSBjYXRjaChlKXt9XG5cbiAgdmFyIHNwbGl0ID0gKG5hbWUgfHwgJycpLnNwbGl0KC9bXFxzLF0rLylcbiAgICAsIGxlbiA9IHNwbGl0Lmxlbmd0aDtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgbmFtZSA9IHNwbGl0W2ldLnJlcGxhY2UoJyonLCAnLio/Jyk7XG4gICAgaWYgKG5hbWVbMF0gPT09ICctJykge1xuICAgICAgZGVidWcuc2tpcHMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWUuc3Vic3RyKDEpICsgJyQnKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgZGVidWcubmFtZXMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWUgKyAnJCcpKTtcbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogRGlzYWJsZSBkZWJ1ZyBvdXRwdXQuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5kZWJ1Zy5kaXNhYmxlID0gZnVuY3Rpb24oKXtcbiAgZGVidWcuZW5hYmxlKCcnKTtcbn07XG5cbi8qKlxuICogSHVtYW5pemUgdGhlIGdpdmVuIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1cbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmRlYnVnLmh1bWFuaXplID0gZnVuY3Rpb24obXMpIHtcbiAgdmFyIHNlYyA9IDEwMDBcbiAgICAsIG1pbiA9IDYwICogMTAwMFxuICAgICwgaG91ciA9IDYwICogbWluO1xuXG4gIGlmIChtcyA+PSBob3VyKSByZXR1cm4gKG1zIC8gaG91cikudG9GaXhlZCgxKSArICdoJztcbiAgaWYgKG1zID49IG1pbikgcmV0dXJuIChtcyAvIG1pbikudG9GaXhlZCgxKSArICdtJztcbiAgaWYgKG1zID49IHNlYykgcmV0dXJuIChtcyAvIHNlYyB8IDApICsgJ3MnO1xuICByZXR1cm4gbXMgKyAnbXMnO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIG1vZGUgbmFtZSBpcyBlbmFibGVkLCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmRlYnVnLmVuYWJsZWQgPSBmdW5jdGlvbihuYW1lKSB7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBkZWJ1Zy5za2lwcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGlmIChkZWJ1Zy5za2lwc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBkZWJ1Zy5uYW1lcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGlmIChkZWJ1Zy5uYW1lc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufTtcblxuLyoqXG4gKiBDb2VyY2UgYHZhbGAuXG4gKi9cblxuZnVuY3Rpb24gY29lcmNlKHZhbCkge1xuICBpZiAodmFsIGluc3RhbmNlb2YgRXJyb3IpIHJldHVybiB2YWwuc3RhY2sgfHwgdmFsLm1lc3NhZ2U7XG4gIHJldHVybiB2YWw7XG59XG5cbi8vIHBlcnNpc3RcblxudHJ5IHtcbiAgaWYgKHdpbmRvdy5sb2NhbFN0b3JhZ2UpIGRlYnVnLmVuYWJsZShsb2NhbFN0b3JhZ2UuZGVidWcpO1xufSBjYXRjaChlKXt9XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiSXJYVXN1XCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbm9kZV9tb2R1bGVzL25vYmxlL25vZGVfbW9kdWxlcy9kZWJ1Zy9kZWJ1Zy5qc1wiLFwiL25vZGVfbW9kdWxlcy9ub2JsZS9ub2RlX21vZHVsZXMvZGVidWdcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5cbi8qKlxuICogTW9kdWxlIGRlcGVuZGVuY2llcy5cbiAqL1xuXG52YXIgZ2xvYmFsID0gKGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSkoKTtcblxuLyoqXG4gKiBXZWJTb2NrZXQgY29uc3RydWN0b3IuXG4gKi9cblxudmFyIFdlYlNvY2tldCA9IGdsb2JhbC5XZWJTb2NrZXQgfHwgZ2xvYmFsLk1veldlYlNvY2tldDtcblxuLyoqXG4gKiBNb2R1bGUgZXhwb3J0cy5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdlYlNvY2tldCA/IHdzIDogbnVsbDtcblxuLyoqXG4gKiBXZWJTb2NrZXQgY29uc3RydWN0b3IuXG4gKlxuICogVGhlIHRoaXJkIGBvcHRzYCBvcHRpb25zIG9iamVjdCBnZXRzIGlnbm9yZWQgaW4gd2ViIGJyb3dzZXJzLCBzaW5jZSBpdCdzXG4gKiBub24tc3RhbmRhcmQsIGFuZCB0aHJvd3MgYSBUeXBlRXJyb3IgaWYgcGFzc2VkIHRvIHRoZSBjb25zdHJ1Y3Rvci5cbiAqIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2VpbmFyb3Mvd3MvaXNzdWVzLzIyN1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1cmlcbiAqIEBwYXJhbSB7QXJyYXl9IHByb3RvY29scyAob3B0aW9uYWwpXG4gKiBAcGFyYW0ge09iamVjdCkgb3B0cyAob3B0aW9uYWwpXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIHdzKHVyaSwgcHJvdG9jb2xzLCBvcHRzKSB7XG4gIHZhciBpbnN0YW5jZTtcbiAgaWYgKHByb3RvY29scykge1xuICAgIGluc3RhbmNlID0gbmV3IFdlYlNvY2tldCh1cmksIHByb3RvY29scyk7XG4gIH0gZWxzZSB7XG4gICAgaW5zdGFuY2UgPSBuZXcgV2ViU29ja2V0KHVyaSk7XG4gIH1cbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG5pZiAoV2ViU29ja2V0KSB3cy5wcm90b3R5cGUgPSBXZWJTb2NrZXQucHJvdG90eXBlO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIklyWFVzdVwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL25vZGVfbW9kdWxlcy93cy9saWIvYnJvd3Nlci5qc1wiLFwiL25vZGVfbW9kdWxlcy93cy9saWJcIikiLCJtb2R1bGUuZXhwb3J0cz17XG4gIFwibmFtZVwiOiBcInNreW5ldC1oZWFydGJlYXRcIixcbiAgXCJ2ZXJzaW9uXCI6IFwiMC4yLjBcIixcbiAgXCJkZXNjcmlwdGlvblwiOiBcIlNreW5ldCBHYXRlYmx1IGFuZCBNb2JpYmx1IEhlYXJ0YmVhdCBwbHVnaW5cIixcbiAgXCJtYWluXCI6IFwiaW5kZXguanNcIixcbiAgXCJzY3JpcHRzXCI6IHtcbiAgICBcInRlc3RcIjogXCJtb2NoYVwiXG4gIH0sXG4gIFwicmVwb3NpdG9yeVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiZ2l0XCIsXG4gICAgXCJ1cmxcIjogXCJnaXQ6Ly9naXRodWIuY29tL3BldGVyZGVtYXJ0aW5pL3NreW5ldC1oZWFydGJlYXQuZ2l0XCJcbiAgfSxcbiAgXCJrZXl3b3Jkc1wiOiBbXG4gICAgXCJNb2JpYmx1XCIsXG4gICAgXCJHYXRlYmx1XCIsXG4gICAgXCJTa3luZXRcIixcbiAgICBcIk1lc2hibHVcIlxuICBdLFxuICBcImF1dGhvclwiOiBcIlBldGVyIERlTWFydGluaVwiLFxuICBcImxpY2Vuc2VcIjogXCJNSVRcIixcbiAgXCJidWdzXCI6IHtcbiAgICBcInVybFwiOiBcImh0dHBzOi8vZ2l0aHViLmNvbS9wZXRlcmRlbWFydGluaS9za3luZXQtaGVhcnRiZWF0L2lzc3Vlc1wiXG4gIH0sXG4gIFwiaG9tZXBhZ2VcIjogXCJodHRwczovL2dpdGh1Yi5jb20vcGV0ZXJkZW1hcnRpbmkvc2t5bmV0LWhlYXJ0YmVhdFwiLFxuICBcImRldkRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJndWxwLXJlbmFtZVwiOiBcIn4xLjIuMFwiLFxuICAgIFwiZ3VscFwiOiBcIn4zLjguN1wiLFxuICAgIFwiZ3VscC11Z2xpZnlcIjogXCJ+MS4wLjBcIixcbiAgICBcImd1bHAtYnJvd3NlcmlmeVwiOiBcIn4wLjUuMFwiLFxuICAgIFwibW9jaGFcIjogXCJ+MS4yMS40XCJcbiAgfSxcbiAgXCJkZXBlbmRlbmNpZXNcIjoge1xuICAgIFwibm9ibGVcIjogXCJnaXQ6Ly9naXRodWIuY29tL29jdG9ibHUvbm9ibGVcIixcbiAgICBcIndzXCI6IFwifjAuNC4zMlwiXG4gIH1cbn1cbiIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIG5vYmxlID0gcmVxdWlyZSgnbm9ibGUnKTtcblxuZnVuY3Rpb24gU2Nhbm5lcih0aW1lb3V0LCBzZXJ2aWNlVXVpZHMsIGRvbmUsIGxvZ0l0KSB7XG5cdHZhciBzZWxmID0gdGhpcywgcGVyaXBoZXJhbDtcblxuXHRzZWxmLmxvZ0l0ID0gbG9nSXQ7XG5cblx0c2VsZi50aW1lb3V0ID0gbnVsbDtcblxuXHRmdW5jdGlvbiBzdG9wU2Nhbm5pbmcoKSB7XG5cdFx0Y2xlYXJUaW1lb3V0KHNlbGYudGltZW91dCk7XG5cdCAgbm9ibGUuc3RvcFNjYW5uaW5nKCk7XG5cdCAgbm9ibGUucmVtb3ZlQWxsTGlzdGVuZXJzKCdkaXNjb3ZlcicpO1xuXHQgIGlmKCFwZXJpcGhlcmFsKXtcblx0ICBcdHNlbGYubG9nRXZlbnQobnVsbCwgJ1N0b3AgU2Nhbm5pbmcgZm9yIEJMRSBkZXZpY2VzLi4uJyk7XG5cdCAgfVxuXHQgIGRvbmUocGVyaXBoZXJhbCk7XG5cdH1cblxuICBub2JsZS5vbignZGlzY292ZXInLCBmdW5jdGlvbiAoX3BlcmlwaGVyYWwpIHtcblx0ICBzZWxmLmxvZ0V2ZW50KG51bGwsICdGb3VuZCBIZWFydGJlYXQgRGV2aWNlIDogJyArIF9wZXJpcGhlcmFsLmFkdmVydGlzZW1lbnQubG9jYWxOYW1lKTtcblx0ICBpZiAoX3BlcmlwaGVyYWwpIHtcblx0ICBcdHBlcmlwaGVyYWwgPSBfcGVyaXBoZXJhbDtcblx0ICAgIHN0b3BTY2FubmluZygpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICBzZWxmLmxvZ0V2ZW50KCdJbnZhbGlkIFBlcmlwaGVyYWwnKTtcblx0ICB9XG5cdH0pO1xuICBpZiAoIUFycmF5LmlzQXJyYXkoc2VydmljZVV1aWRzKSkge1xuICAgIHNlcnZpY2VVdWlkcyA9IFtzZXJ2aWNlVXVpZHNdO1xuICB9XG4gIG5vYmxlLnN0YXJ0U2Nhbm5pbmcoc2VydmljZVV1aWRzLCB0cnVlKTtcblxuICBzZWxmLmxvZ0V2ZW50KG51bGwsICdTY2FubmluZyBmb3IgSGVhcnRiZWF0IERldmljZXMnKTtcbiAgc2VsZi50aW1lb3V0ID0gc2V0VGltZW91dChzdG9wU2Nhbm5pbmcsIHRpbWVvdXQpO1xufVxuXG5TY2FubmVyLnByb3RvdHlwZS5sb2dFdmVudCA9IGZ1bmN0aW9uIChlcnIsIG1zZyl7XG5cdGNvbnNvbGUubG9nKGVyciB8fCBtc2cpO1xuIFx0dGhpcy5sb2dJdChlcnIsIG1zZyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNjYW5uZXI7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIklyWFVzdVwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL3NjYW4uanNcIixcIi9cIikiXX0=
(1)
});
