'use strict';

var noble = require('noble');

function Scanner(timeout, serviceUuids, done, logIt) {
	var self = this;

	self.logIt = logIt;

	self.peripheral = null;

	self.done = done;

  noble.on('discover', function (peripheral) {
	  self.logEvent(null, 'Found Heartbeat Device : ' + peripheral.advertisement.localName);
	  if (peripheral) {
	  	self.peripheral = peripheral;
	    self.stopScanning();
	  } else {
	    self.logEvent('Invalid Peripheral');
	  }
	});
  if (!Array.isArray(serviceUuids)) {
    serviceUuids = [serviceUuids];
  }
  noble.startScanning(serviceUuids, true);

  self.logEvent(null, 'Scanning for Heartbeat Devices');
  setTimeout(self.stopScanning, timeout);
}

Scanner.prototype.logEvent = function (err, msg){
	console.log(err || msg);
 	this.logIt(err, msg);
};

Scanner.prototype.stopScanning = function() {
	var self = this;
  noble.stopScanning();
  noble.removeAllListeners('discover');
  if(!self.peripheral){
  	self.logEvent(null, 'Stop Scanning for BLE devices...');
  }
  self.done(self.peripheral);
};

module.exports = Scanner;