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
		this.timeout(20 * 1000);
		api.logHeartrate = function(hr){
			assert(typeof hr === 'number');
			assert(hr > 0);
			done();
		};
		heartrate.init({}, api);
	});
});