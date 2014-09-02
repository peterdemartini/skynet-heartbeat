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
  scan(5000, serviceUuids, peripherals, function(peripherals) {
    console.log('finished scanning', peripherals);
    peripherals = peripherals.map(function(peripheral) {
      var p = _.clone(peripheral);
      delete p._noble;
      return p;
    });
    peripherals = _.filter(peripherals, function(peripheral){
    	return _.contains(peripheral.advertisement.serviceUuids, serviceUuid);
    });
    fn();
  });
}

function discover(fn) {
	_.each(peripherals, function(peripheral){
	 peripheral.discoverServices(serviceUuids, function(error, services) {
	    var deviceService = services[0];
	    if(!deviceService){
		    console.log('no heart rate service found', services);
	    	return fn({ error : 'No heart rate service found' });
	    }else{
  		  console.log('discovered heart rate service for read', deviceService);
	    }
	    deviceService.discoverCharacteristics([characteristicUuid], function(error, characteristics) {
	      if (error) {
	        console.log('error discovering characteristics', error);
	        fn({
	          error: error
	        });
	      } else {
	        var manCharacteristic = characteristics[0];
	        console.log('discovered heart rate characteristic for read', characteristics);

	        manCharacteristic.read(function(error, data) {
	          // data is a buffer
          	console.log('value is: ', data, typeof data);
          	data.uuid = peripheral.uuid;
            fn(data);
	        });
	      }
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
        api.logIt(data.error);
      } else {
        api.logIt(null, JSON.stringify(data));
        api.logHeartrate(82);
      }
    });
  });

};

module.exports = lib;