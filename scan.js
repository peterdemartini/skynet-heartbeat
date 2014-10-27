'use strict';

var noble = require('noble');

function Scanner(timeout, serviceUuids, done, logIt) {
	var self = this, peripheral;

	self.logIt = logIt;

	self.timeout = null;

	function stopScanning() {
		clearTimeout(self.timeout);
	  noble.stopScanning();
	  noble.removeAllListeners('discover');
	  if(!self.peripheral){
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