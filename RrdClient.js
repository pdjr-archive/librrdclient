const net = require('net');

module.exports = class RrdClient {

  constructor(options = {}) {
    this.options = options;
    this.cstring = null;
    this.socket = null;
    this.dbname = null;
  }

  /********************************************************************
   * connect(cstring)
   */

  async connect(cstring, callback) {
    if (this.options.debug) console.log("RrdClient.connect(%s,%o)...", cstring, callback);
    this.cstring = cstring;
    var parts = this.cstring.split(':');
    if (parts.length == 1) { // local pipe
      return new Promise(function(resolve, reject) {
        this.socket = net.createConnection(parts[0]);
        this.socket.on('connect', function() { resolve(this.socket); });
        this.socket.on('error', function() { reject(null); });
        this.socket.on('data', function(data) { callback(data.toString()); });
      }.bind(this));
    } else {
      return new Promise(function(resolve, reject) {
        var socket;
        this.socket = new net.Socket();
        this.socket.connect(parts[1], parts[0]);
        this.socket.on('connect', function() { resolve(this.socket); });
        this.socket.on('error', function() { reject(null); });
        this.socket.on('close', function(err) { this.socket.connect(parts[1], parts[0]); });
        this.socket.on('data', function(data) { callback(data.toString('utf8')); });
      }.bind(this));
    }
  }
 
  async createDatabase(name, opts, DSs, RRAs) {
    if (this.options.debug) console.log("RrdClient.createDatabase(%s,%s,%s,%s)...", name, JSON.stringify(opts), DSs, RRAs);
    return new Promise(function(resolve, reject) {
	  var command = "create " + name;
      command += (opts.start)?(" -b " + opts.start):"";
      command += (opts.step)?(" -s " + opts.step):"";
      command += (opts.preserve)?" -O":"";
      command += (opts.source)?(" -r " + opts.source):"";
	  DSs.forEach(ds => command += (" " + ds.trim())); 
	  RRAs.forEach(rra => command += (" " + rra.trim())); 
      if (this.options.debug) console.log("RrdClient: issuing command: %s", command);
      this.socket.write(command + "\n", 'utf8', function(error, data) {
        if (error) { console.log(data.toString()); reject(false); } else { resolve(true); }
      });
    }.bind(this));
  }

  async updateDatabase(name, values) {
    if (this.options.debug) console.log("RrdClient.updateDatabase(%s,%o)...", name, values);
    return new Promise(function(resolve, reject) {
      var command = "update " + name;
      command += " " + Math.floor((new Date()) / 1000) + ":" + values.join(':');
      if (this.options.debug) console.log("RrdClient: issuing command: %s", command);
      this.socket.write(command + "\n", 'utf8', function(error, data) {
        if (error) { console.log(data.toString()); reject(false); } else { resolve(true); }
      });
    }.bind(this));
  }
/*
  async createChart(name, chart) {
    if (DEBUG) console.log("rrdtool:createChart('" + group + "', '" + chart + "')...");

    var retval = false;
    if (RRDCHARTD_SOCKET != null) {
        retval = await _createChartPromise(group, chart).catch(error => {
            retval = false;
        });
    }
    return(retval);
}

var _createChartPromise = function(group, chart) {
    return new Promise(function(resolve, reject) {
        RRDCHARTD_SOCKET.write(group + " " + chart + "\n", 'utf8', function(error, data) {
            if (error) { reject(false); } else { resolve(true); }
        });
    });
}
*/
}

