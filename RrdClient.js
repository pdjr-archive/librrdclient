const net = require('net');
const { spawn } = require('child_process');

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
        this.socket = new net.Socket();
        this.socket.connect(parts[1], parts[0]);
        this.socket.on('connect', function() { resolve(this.socket); });
        this.socket.on('error', function() { reject(null); });
        this.socket.on('close', function(err) { this.socket.connect(parts[1], parts[0]); });
        this.socket.on('data', function(data) { callback(data.toString('utf8')); });
      }.bind(this));
    }
  }
 
  async create(name, opts, DSs, RRAs) {
    if (this.options.debug) console.log("RrdClient.create(%s,%s,%s,%s)...", name, JSON.stringify(opts), DSs, RRAs);
    return new Promise(function(resolve, reject) {
	  var command = "create " + name;
      command += (opts.start)?(" -b " + opts.start):"";
      command += (opts.step)?(" -s " + opts.step):"";
      command += (opts.preserve)?" -O":"";
      command += (opts.source)?(" -r " + opts.source):"";
	  DSs.forEach(ds => command += (" " + ds.trim())); 
	  RRAs.forEach(rra => command += (" " + rra.trim())); 
      if (this.options.debug) console.log("RrdClient: issuing command: %s", command);
      if (this.socket.write(command + "\n", 'utf8')) { resolve(true); } else { reject(false); }
    }.bind(this));
  }

  async update(name, seconds, values) {
    if (this.options.debug) console.log("RrdClient.update(%s,,%s,%o)...", name, seconds,values);
    return new Promise(function(resolve, reject) {
      var command = "UPDATE " + name;
      command += " " + seconds + ":" + values.join(':');
      if (this.options.debug) console.log("RrdClient: issuing command: %s", command);
      if (this.socket.write(command + "\n", 'utf8')) { resolve(true); } else { reject(false); }
    }.bind(this));
  }

  async flush(name) {
    if (this.options.debug) console.log("RrdClient.flush(%s)...", name);
    return new Promise(function(resolve, reject) {
      var command = "FLUSH " + name;
      if (this.options.debug) console.log("RrdClient: issuing command: %s", command);
      if (this.socket.write(command + "\n", 'utf8')) { resolve(true); } else { reject(false); }
    }.bind(this));
  }

  async graph(name, args, logN, logE) {
    if (this.options.debug) console.log("RrdClient.graph(%s,%s)...", name, JSON.stringify(args));
    return new Promise(function(resolve, reject) {
      args.unshift(name); args.unshift("graph");
      if (this.options.debug) console.log("RrdClient: issuing command: %s %s", "rrdtool", args.join(' '));
	  var child = spawn("rrdtool", args, { shell: true, env: process.env });
      if (child != null) {
        child.on('close', (code) => { if (logN) logN("Successful renotification using '" + path.basename(command) + "'"); });
	    child.on('error', (code) => { if (logE) logE("Renotification by '" + path.basename(command) + "' failed"); });
      }
    }.bind(this));
  }

}

