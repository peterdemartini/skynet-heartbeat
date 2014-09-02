'use strict';

var assert = require('assert');

var heartrate = require('../heartrate');

var api = {};

describe('Heart Rate Monitor', function(){
	beforeEach(function(){
		api.logIt = function(){

		};
	});
	it('should log heart rate', function(done){
		this.timeout(30 * 1000); // Try for 30 seconds
		var count = 0;
		api.logHeartrate = function(hr){
			count++;
			if(count < 5){
				return;
			}
			assert(typeof hr === 'number');
			assert(hr > 0);
			done();
		};
		heartrate.init({}, api);
	});
});