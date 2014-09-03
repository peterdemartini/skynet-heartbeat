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
  scan(15 * 1000, serviceUuids, peripherals, function(peripherals) {
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
    function getHeartrate(data) {
      if (data instanceof Uint8Array) {
        return data;
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

    function onConnect() {
      getServices();
    }

    function connect() {
      peripheral.connect(onConnect);
    }

    if (peripheral.state === 'connected') {
      console.log('Already connected to peripheral');
      onConnect();
    } else {
      console.log('Connecting to peripheral');
      connect();
    }

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