'use strict';

var noble = require('noble');
var stopandreturn, discover;

stopandreturn = function() {
  noble.stopScanning();
  noble.removeListener('discover', discover);
  console.log('Stop Scanning for BLE devices...');
  this.logIt(null, 'Stopped Scanning for Heartbeat Devices');
  this.done(this.peripherals);
};

discover = function(peripheral) {
  console.log('(scan)found: ' + peripheral.advertisement.localName);
  this.logIt(null, 'Found Heartbeat Device : ' + peripheral.advertisement.localName);
  if (peripheral) {
    this.peripherals.unshift(peripheral);
    stopandreturn.bind(this);
  } else {
    this.logIt('Invalid Peripheral');
    console.log('Invalid Peripheral');
  }
};

module.exports = function(timeout, serviceUuids, peripherals, done, logIt) {
  noble.on('discover', discover.bind({
    peripherals: peripherals,
    logIt: logIt,
    timeout: timeout
  }));
  if (!Array.isArray(serviceUuids)) {
    serviceUuids = [serviceUuids];
  }
  noble.startScanning(serviceUuids);
  console.log('Scanning for BLE devices...');
  logIt(null, 'Scanning for Heartbeat Devices');
  setTimeout(stopandreturn.bind({
    timeout: timeout,
    peripherals: peripherals,
    done: done,
    logIt: logIt
  }), timeout);
};