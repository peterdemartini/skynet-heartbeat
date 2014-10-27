'use strict';

var noble = require('noble');

function Scanner(timeout, serviceUuids, done, logIt) {
	var self = this;

	self.logIt = logIt;

	self.peripheral = null;

	self.done = done;

  noble.on('discover', self.discoverMonitor.bind(self));
  if (!Array.isArray(serviceUuids)) {
    serviceUuids = [serviceUuids];
  }
  noble.startScanning(serviceUuids);

  self.logEvent('Scanning for Heartbeat Devices');
  setTimeout(self.stopScanning, timeout);
}

Scanner.prototype.logEvent = function (err, msg){
	console.log(err || msg);
 	this.logIt(err, msg);
};

Scanner.prototype.stopScanning = function() {
	var self = this;
  noble.stopScanning();
  noble.removeListener('discover', self.discoverMonitor);
  self.logEvent('Stop Scanning for BLE devices...');
  self.done(self.peripheral);
};

Scanner.prototype.discoverMonitor = function (peripheral) {
	var self = this;
  self.logEvent('Found Heartbeat Device : ' + peripheral.advertisement.localName);
  if (peripheral) {
  	self.peripheral = peripheral;
    self.stopScanning();
  } else {
    self.logIt('Invalid Peripheral');
    console.log('Invalid Peripheral');
  }
};

module.exports = Scanner;