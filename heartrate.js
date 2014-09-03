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
	function onRead(data) {
	  if (data) {
	    var returnObj = {
	      heartRate: data.readUInt8(1)
	    };
	    console.log('heart rate', returnObj.heartRate);
	    fn(returnObj);
	  } else {
	    fn({
	      error: 'Unable to read to heart rate'
	    });
	  }
	}
  _.each(peripherals, function(peripheral) {
    peripheral.connect(function() {
      console.log('Connected to peripheral');
      // Android Specific
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

            // Works on non-phonegap
            mainCharacteristic.on('read', onRead);

            // true to enable notify
            mainCharacteristic.notify(true, function(error) {
              console.log('heart rate level notification');
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
        console.log('Error in Heartbeat Plugin: ' + JSON.stringify(data.error));
        api.logIt(data.error);
      } else {
        api.logHeartrate(data.heartRate);
      }
    });
  });

};

module.exports = lib;