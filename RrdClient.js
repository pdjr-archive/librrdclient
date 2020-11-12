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
   * connect(cstring, callback) returns a promise. If <cstring> is
   * undefined, then the promise immediately resolves 
   * call resolves to a null value. Otherwise, the function resolves
   * to 
   * an open socket connection to the RRD service specified by
   * <cstring>
   */

  async connect(cstring, callback) {
    if (this.options.debug) console.log("RrdClient.connect(%s,%o)...", cstring, callback);
    this.cstring = cstring;
    return new Promise(function(resolve, reject) {
      if (this.cstring === undefined) {
        resolve(this.socket);
      } else {
        var parts = this.cstring.split(':').map(p => p.trim());
        if (parts.length == 1) { // local pipe
          this.socket = net.createConnection(parts[0]);
          this.socket.on('connect', function() { resolve(this.socket); });
          this.socket.on('error', function() { this.socket = null; reject(null); });
          this.socket.on('data', function(data) { callback(data.toString()); });
        } else {
          this.socket = new net.Socket();
          this.socket.connect(parts[1], parts[0]);
          this.socket.on('connect', function() { resolve(this.socket); });
          this.socket.on('error', function() { this.socket = null; reject(null); });
          this.socket.on('close', function(err) { this.socket.connect(parts[1], parts[0]); });
          this.socket.on('data', function(data) { callback(data.toString('utf8')); });
        }
      }
    }.bind(this));
  }
 
  async create(name, opts, DSs, RRAs) {
    if (this.options.debug) console.log("RrdClient.create(%s,%s,%s,%s)...", name, JSON.stringify(opts), DSs, RRAs);
    return new Promise(function(resolve, reject) {
	  var args = [], command;
      args.push("CREATE"); args.push(name);
      opts.forEach(opt => { args.push(opt.name); args.push(opt.value); });
	  DSs.forEach(ds => args.push(ds.trim())); 
	  RRAs.forEach(rra => args.push(rra.trim())); 
      if (this.socket) {
        command = args.join(' ');
        if (this.options.debug) console.log("RrdClient: issuing command: %s to %s", command, this.cstring);
        if (this.socket.write(command + "\n", 'utf8')) { resolve(true); } else { reject(false); }
      } else {
        command = "rrdtool";
        if (this.options.debug) console.log("RrdClient: spawning %s with args = %s", command, JSON.stringify(args));
	    var child = spawn(command, args, { shell: true, env: process.env });
        if (child != null) {
          child.on('close', (code) => { resolve(true); });
	      child.on('error', (code) => { reject(false); });
        }
      }
    }.bind(this));
  }

  async update(name, values, timestamp = Math.floor(Date.now() / 1000)) {
    if (this.options.debug) console.log("RrdClient.update(%s,,%s,%s)...", name, values, timestamp);
    return new Promise(function(resolve, reject) {
      var args = [], command;
      args.push("UPDATE"); args.push(name);
      args.push(timestamp + ":" + values.join(':'));
      if (this.socket) {
        command = args.join(' ');
        if (this.options.debug) console.log("RrdClient: issuing command: %s to %s", command, this.cstring);
        if (this.socket.write(command + "\n", 'utf8')) { resolve(true); } else { reject(false); }
      } else {
        command = "rrdtool";
        if (this.options.debug) console.log("RrdClient: spawning %s with args = %s", command, JSON.stringify(args));
	    var child = spawn(command, args, { shell: true, env: process.env });
        if (child != null) {
          child.on('close', (code) => { resolve(true); });
	      child.on('error', (code) => { reject(false); });
        }
      }
    }.bind(this));
  }

  async flush(name) {
    if (this.options.debug) console.log("RrdClient.flush(%s)...", name);
    return new Promise(function(resolve, reject) {
      var args = [], command;
      args.push("FLUSH"); args.push(name);
      if (this.socket) {
        command = args.join(' ');
        if (this.options.debug) console.log("RrdClient: issuing command: %s to %s", command, this.cstring);
        if (this.socket.write(command + "\n", 'utf8')) { resolve(true); } else { reject(false); }
      } else {
        command = "rrdtool";
        if (this.options.debug) console.log("RrdClient: spawning %s with args = %s", command, JSON.stringify(args));
	    var child = spawn(command, args, { shell: true, env: process.env });
        if (child != null) {
          child.on('close', (code) => { resolve(true); });
	      child.on('error', (code) => { reject(false); });
        }
      }
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

