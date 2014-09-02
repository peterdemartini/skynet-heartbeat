'use strict';

var scan = require('./scan'),
  _ = require('lodash');

var lib = {},
  options,
  api,
  serviceUuid = '180d',
  serviceUuids = [serviceUuid],
  peripherals = [],
  characteristicUuid = '2a37';

function getPeripherals(fn) {
  scan(10 * 1000, serviceUuids, peripherals, function(peripherals) {
    console.log('finished scanning', peripherals);
    peripherals = peripherals.map(function(peripheral) {
      var p = _.clone(peripheral);
      delete p._noble;
      return p;
    });
    fn();
  });
}

function discover(fn) {
  _.each(peripherals, function(peripheral) {
    peripheral.connect(function() {
      console.log('Connected to peripheral');
      peripheral.discoverServices(serviceUuids, function(error, services) {
        var deviceService = services[0];
        if (!deviceService) {
          console.log('no heart rate service found', services);
          return fn({
            error: 'No heart rate service found'
          });
        } else {
          console.log('discovered heart rate service for read', deviceService.uuid);
        }
        deviceService.discoverCharacteristics([characteristicUuid], function(error, characteristics) {
          if (error) {
            console.log('error discovering characteristics', error);
            fn({
              error: error
            });
          } else {
            var mainCharacteristic = characteristics[0];
            console.log('discovered heart rate characteristic for read', mainCharacteristic.uuid);

            if(typeof window !== 'undefined' && window.device && window.device.platform === 'Android'){
            	mainCharacteristic.on('notify', function(error, bytes) {
	              //Check for data
	              if (bytes.length === 0) {
	                api.logIt('Subscription result had zero length data');
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
	              console.log('Heart Rate:: ' + hr);
	              var returnObj = { heartRate : hr };
	              fn(returnObj);
	            });
            }else{
            	mainCharacteristic.on('read', function(data) {
	              if (data) {
	                var returnObj = {
	                  heartRate: data.readUInt8(1)
	                };
	                console.log('heart rate', returnObj.heartRate);
	                fn(returnObj);
	              }
	            });
            }

            // true to enable notify
            mainCharacteristic.notify(true, function(error) {
              console.log('heart rate level notification on', error);
              if (error) {
                fn({
                  error: 'Unable to subscribe to heart rate'
                });
              }
            });
          }
        });
      });
    });
  });
}

lib.init = function(opts, newApi) {
  options = opts;
  api = newApi;

  getPeripherals(function() {
    discover(function(data) {
      if (!data) data = {};
      if (data.error) {
        console.log('Error in Heartbeat Plugin' + JSON.stringify(data.error));
        api.logIt(data.error);
      } else {
        api.logHeartrate(data.heartRate);
      }
    });
  });

};

module.exports = lib;