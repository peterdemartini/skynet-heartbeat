'use strict';

var Scanner = require('./scan');

var lib = {},
  options,
  api,
  serviceUuid = '180d',
  serviceUuids = [serviceUuid],
  characteristicUuid = '2a37';

function startMonitor(fn) {
  new Scanner(25 * 1000, serviceUuids, function(peripheral) {
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