/* <license>
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
 </license> */

/**
 *   @version:    1.0.0
 *
 *   @overview  CloudPlugs REST Client for Javascript
 *   is a library to perform REST requests to the CloudPlugs server.
 *   Browser and Node.js are the intended platforms.
 *   Official repository https://github.com/cloudplugs/js
 *
 *   CloudPlugs is a cloud based IOT platform aimed to enable interconnection
 *   of smart "things" (sensors, smartphones, home appliances, etc).
 *   Different objects can interact with each other by publishing and/or reading
 *   any type of data on shared channels through a simple communication protocol.
 *   Get your account on www.cloudplugs.com
 */

(function(){

    // this is what the lib is going to export
    var exports = {
        RestClient: RestClient
    };
    // expose lib features
    try {
        module.exports = exports; // this is for node.js
    } catch(err) {
        // this is for the browser
        var isBrowser = true;
        var G = (function(){ return this })(); // get the global environment
        G.cloudplugs = G.cloudplugs || {}; // ensure the namespace is defined
        expand(G.cloudplugs, exports); // pass everything
    }

    var BASE_URL = 'https://api.cloudplugs.com/iot/';

    /** Basic constructor
     * @class Instantiate this to communicate with CloudPlugs.
     * All methods accept parameters in the same way: <b>a single object containing every parameter</b>, and a second parameter for the callback function(err,result).
     * You can optionally pass the callback within params using key 'cb', but the second parameter has priority over it.
     * @param {string} id - optional, if present, is passed to {@linkcode RestClient#setAuth|setAuth}.
     * @param {string} password - optional, if present, is passed to {@linkcode RestClient#setAuth|setAuth}..
     * @param {boolean} isMaster - optional, if present, is passed to {@linkcode RestClient#setAuth|setAuth}..
     * @param {boolean} debug - optional, trace activity in the console and accept invalid https certificates. Default: false.
     * @param {string} url - optional, Set an URL that will be used as base for all web services. Default: https//api.cloudplugs.com/iot/ .
     * @param {boolean} acceptUnauthorized - optional, in case of https, the certificate won't be verified. Default: false.
     * @param {boolean} dontLoadCA - optional, prevent the library from loading the included CA certificates. Default: false.
     * @property {boolean} postOnly - force usage of HTTP POST for all requests by using X-HTTP-Method-Override. Default: false.
     */
    function RestClient(params){
        var p = params||{}; // shortcut;
        p.id && this.setAuth(p);

        checkParams(p, { url:'url', 'debug,acceptUnauthorized,dontLoadCA':'boolean' });
        if (p.url && p.url.substr(-1) !== '/') p.url += '/';
        this._baseUrl = p.url || BASE_URL;

        this._debug = p.debug;

        this._isHTTPS = /^https:/i.test(this._baseUrl);
        this._log('URL: '+this._baseUrl);
        if (isBrowser) return;

        var agentOptions = { maxSockets:1, rejectUnauthorized:!p.acceptUnauthorized };

        if (this._isHTTPS && !p.acceptUnauthorized && !p.dontLoadCA) {
            var s = require('fs').readFileSync('cacert.pem');
            var re = /(-----BEGIN CERTIFICATE-----(\n|.)+?-----END CERTIFICATE-----)/g;
            var v;
            var ca = [];
            while (v = re.exec(s))
                ca.push(v[1]);
            agentOptions.ca = ca;
        }

        this._http = require(this._isHTTPS ? 'https' : 'http');
        this._agent = new this._http.Agent(agentOptions);
    }//constructor

    //// METHODS

    /** Set authorization information. You can authenticate in 3 ways:
     * <li>with your CloudPlugs account (email, password), this is also called "master authentication"
     * <li>by using the Thing's ID and password,
     * <li>with a mix of both methods above, by giving the Thing's ID and your CloudPlugs account password, this is also called "hybrid authentication".
     * @param {string} id - can be the plug-id of the device, or your account email.
     * @param {string} password - related password.
     * @param {boolean} isMaster - optional, means the password is meant to be the one of your CloudPlugs account, otherwise is the one of your device.
     */
    RestClient.prototype.setAuth = function(params) {
        var p = params; // shortcut
        checkParams(p, { id:'mandatory,plugidpub|email', password:'password'})
        this._log('new auth: '+ p.id);
        this._plugId = isPlugIdPub(p.id) && p.id;
        this._email = isEmail(p.id) && p.id;
        this._pwd = p.password;
        this._isMaster = !!p.isMaster;
    };//setAuth

    /** Get authentication information back.
     * @returns {object} the parameters passed to {@linkcode setAuth}.
     */
    RestClient.prototype.getAuth = function() {
        var id = this._plugId||this._email;
        return !id ? null : {
            id: id,
            password: this._pwd,
            isMaster: this._isMaster
        };
    };//getAuth

    /** Register a new prototype on the platform. Master or hybrid authentication is required.
     * @param {string} name - name of the prototype
     * @param {string} [hwid] - optional, serial number. If not specified, a random one will be generated.
     * @param {string} pass - optional, a password to use to authenticate the device. If not specified, you'll still be able to used the master password to authenticate.
     * @param {Perm} perm - optional, permissions descriptor.
     * @param {object} props - optional, custom properties to set with the device.
     * @param {cb:enrollPrototype} cb - optional, callback to get the response
     */
    RestClient.prototype.enrollPrototype = function(params, cb){
        var p = params; // shortcut
        checkParams(p, { name:'mandatory,string', 'hwid,pass':'string' });
        this._log('enroll prototype: '+ p.name);
        return this.request({ master:true, method:'POST', uri:'device', body:p }, cb||p);
    };//enrollPrototype
/**
 * @callback cb:enrollPrototype
 * @param {Error} err - in case of errors, null otherwise.
 * @param {PlugId} id - the plug-id of the enrolled prototype.
 */

    /** Register a new prototype on the platform. Master or hybrid authentication is required.
     * @param {PlugId} model - plug-id of the model.
     * @param {string} hwid - serial number.
     * @param {string} pass - activation password.
     * @param {object} props - optional, custom properties to set with the device.
     * @param {cb:enrollProduct} cb - optional, callback to get the response
     */
    RestClient.prototype.enrollProduct = function(params, cb) {
        var p = params; // shortcut
        checkParams(p, { model:'mandatory,plugidmod', 'hwid,pass':'mandatory,string' });
        this._log('enroll product: '+ p.hwid+': '+JSON.stringify(newObj(p.key, p.value)));
        var cl = this;
        return this.request({ auth:false, method:'POST', uri:'device', body:p }, function(err,dev){
            if (!err && dev && dev.id) cl.setAuth({ id:dev.id, password:dev.auth });
            call(cb||p.cb, arguments);
        });
    };//enrollProduct
/**
 * @callback cb:enrollProduct
 * @param {Error} err - in case of errors, null otherwise.
 * @param {PlugId} id - the plug-id of the enrolled device.
 * @param {string} auth - password to use from now on to authenticate.
 */

    /** Register a new controller device.
     * @param {PlugId} model - model of the device to control.
     * @param {string} ctrl - serial number of the device to control.
     * @param {string} pass - secret needed for authentication.
     * @param {string} hwid - optional, serial number of this controller device.
     * @param {string} name - optional, a name for this controller device.
     * @param {cb:controlDevice} cb - optional, callback to get the response
     */
    RestClient.prototype.enrollController = function(params, cb) {
        assert(!this._plugId, 'already enrolled');
        return this.controlDevice(params, cb);
    };//enrollController
/**
 * @callback cb:controlDevice
 * @param {Error} err - in case of errors, null otherwise.
 * @param {PlugId} id - the plug-id of the enrolled device.
 */

    /** Require control of another device's data.
     * @param {PlugId} model - model of the device to control.
     * @param {string} ctrl - serial number of the device to control.
     * @param {string} pass - secret needed for authentication.
     * @param {cb:controlDevice} cb - optional, callback to get the response
     */
    RestClient.prototype.controlDevice = function(params, cb) {
        var p = params; // shortcut
        checkParams(p, { model:'mandatory,plugidmod', 'ctrl,pass':'mandatory,string' });
        this._log('control device: '+p.hwid);
        var cl = this;
        return this.request({ auth:false, method:'PUT', uri:'device', body:p }, function(err,dev){
            if (!err && dev && dev.id) cl.setAuth({ id:dev.id, password:dev.auth });
            call(cb||p.cb, arguments);
        });
    };//controlDevice

    /** Revoke control of another device's data.
     * @param {PlugId} of - optional, controller's plug-id, in case it was not used in {@linkcode setAuth}.
     * @param {PlugId|array(PlugId)} controlled - the controlled devices.
     * @param {cb:simple} cb - optional, callback to get the response
     */
    RestClient.prototype.uncontrolDevice = function(params, cb) {
        var p = params; // shortcut
        checkParams(p, { of:'plugidpub', controlled:'plugidpub|[plugidpub]' });
        assert(p && p.of || this._plugId, 'controller not specified');
        this._log('uncontrol device: '+p.controlled);
        return this.request({ method:'DELETE', uri:'device/'+this._plugId, body:minus(p,'of'), master:p && p.of }, cb||p);
    };//uncontrolDevice

    /** Unregister a device (or more).
     * @param {PlugId|array(PlugId)} of - optional, device's plug-id, in case it was not used in {@linkcode setAuth}.
     * @param {cb:unenroll} cb - optional, callback to get the response
     */
    RestClient.prototype.unenroll = function(params, cb) {
        var p = params; // shortcut
        var id = p && p.of || this._plugId;
        assert(id, 'missing plug-id');
        assert(isString(id) || isArray(id), 'invalid plug-id');
        this._log('unenroll: '+id);
        return this.request({ method:'DELETE', uri:'device', body:id, master:p && p.of }, cb||p);
    };//unenroll
/**
 * @callback cb:unenroll
 * @param {Error} err - in case of errors, null otherwise.
 * @param {number} n - number of devices successfully unregistered.
 */

    /** Retrieve general information about the device.
     * @param {PlugId} of - optional, device's plug-id, in case it was not used in {@linkcode setAuth}.
     * @param {cb:getDevice} cb - optional, callback to get the response
     */
    RestClient.prototype.getDevice = function(params, cb){
        var p = params; // shortcut
        checkParams(p, { of:'plugidpub' });
        var id = p && p.of || this._plugId;
        assert(id, 'missing plug-id');
        this._log('get device: '+id);
        return this.request({ method:'GET', uri:'device/'+id }, cb||p);
    };//getDevice
/**
 * @callback cb:getDevice
 * @param {Error} err - in case of errors, null otherwise.
 * @param {Device} dev - general information of the device.
 */

    /** Set general information of the device.
     * @param {PlugId} of - optional, device's plug-id, in case it was not used in {@linkcode setAuth}.
     * @param {string} name - optional, provided name.
     * @param {Perm} perm - optional, permissions to set.
     * @param {Status} status - optional, change status.
     * @param {object} props - optional, custom properties.
     * @param {cb:simple} cb - optional, callback to get the response
     */
    RestClient.prototype.setDevice = function(params, cb){
        var p = params; // shortcut
        checkParams(p, { of:'plugidpub', 'name,status':'string' });
        var id = p && p.of || this._plugId;
        assert(id, 'missing plug-id');
        this._log('set device: '+id);
        return this.request({ method:'PATCH', uri:'device/'+id, body:minus(p,'of') }, cb||p);
    };//setDevice

    /** Set a device's custom property.
     * @param {PlugId} of - optional, device's plug-id, in case it was not used in {@linkcode setAuth}.
     * @param {string} key - key associated to the data.
     * @param value - any value allowed by JSON syntax.
     * @param {cb:simple} cb - optional, callback to get the response
     */
    RestClient.prototype.setDeviceProp = function(params, cb) {
        var p = params; // shortcut
        checkParams(p, { key:'mandatory,string', value:'mandatory', of:'plugidpub' });
        var id = p.of || this._plugId;
        assert(id, 'device ID not specified');
        this._log('set device property: '+id+' '+JSON.stringify(newObj(p.key, p.value)));
        return this.request({ method:'PATCH', uri:'device/'+id+'/'+encodeURIComponent(p.key), body:p.value }, cb||p);
    };//setDeviceProp

    /** Delete a device's custom property.
     * @param {PlugId} of - optional, device's plug-id, in case it was not used in {@linkcode setAuth}.
     * @param {string} key - key associated to the data.
     * @param {cb:simple} cb - optional, callback to get the response
     */
    RestClient.prototype.removeDeviceProp = function(params, cb) {
        var p = params;
        checkParams(p, { key:'mandatory,string', of:'plugidpub' });
        var id = p.of || this._plugId;
        this._log('remove device property: '+id+': '+p.key);
        return this.setDeviceProp(plus(p,{ value:null }), cb);
    };//removeDeviceProp

    /** Retrieve a device's custom property.
     * @param {PlugId} of - optional, device's plug-id, in case it was not used in {@linkcode setAuth}.
     * @param {string} key - key associated to the data.
     * @param {cb:getDeviceProp} cb - optional, callback to get the response
     */
    RestClient.prototype.getDeviceProp = function(params, cb) {
        var p = params; // shortcut
        checkParams(p, { key:'mandatory,string', of:'plugidpub' });
        var id = p.of || this._plugId;
        assert(id, 'device ID not specified');
        this._log('get device property: '+id+' '+p.key);
        return this.request({ method:'GET', uri:'device/'+id+'/'+encodeURIComponent(p.key) }, cb||p);
    };//getDeviceProp
/**
 * @callback cb:getDeviceProp
 * @param {Error} err - in case of errors, null otherwise.
 * @param data - retrieved data.
 */

    /** Set a device's location. The location is stored in the custom properties with key "location", and with a specific format.
     * While you are free to store such kind of information in other ways, using this standard will give you some features,
     * like a map on the platform's user interface.
     * @param {PlugId} of - optional, device's plug-id, in case it was not used in {@linkcode setAuth}.
     * @param {number} x - Longitude, in degrees. This value is in the range [-180, 180).
     * @param {number} y - Latitude, in degrees. This value is in the range [-90, 90].
     * @param {number} r - optional, accuracy in meters.
     * @param {number} z - optional, meters above mean sea level.
     * @param {Timestamp} t - optional, when data was sampled.
     * @param {cb:simple} cb - optional, callback to get the response
     */
    RestClient.prototype.setDeviceLocation = function(params, cb) {
        var p = params; // shortcut
        checkParams(p, { of:'plugidpub', 'x,y':'mandatory,number', 'r,z':'number', t:'timestamp' });
        var id = p.of || this._plugId;
        assert(id, 'missing plug-id');
        this._log('set location: '+id);
        return this.setDeviceProp({ key:'location', value:clone(p,'x,y,r,z,t'), of:p.of }, cb||p);
    };//setDeviceLocation

    /** Retrieve a device's location, as documented in {@linkcode setDeviceLocation}.
     * @param {PlugId} of - optional, device's plug-id, in case it was not used in {@linkcode setAuth}.
     * @param {cb:getDeviceLocation} cb - optional, callback to get the response
     */
    RestClient.prototype.getDeviceLocation = function(params, cb) {
        var p = params; // shortcut
        checkParams(p, { of:'plugidpub' });
        var id = p.of || this._plugId;
        assert(id, 'missing plug-id');
        this._log('get location: '+id);
        return this.getDeviceProp({ key:'location', of:p.of }, cb||p);
    };//getDeviceLocation
/**
 * @callback cb:getDeviceLocation
 * @param {Error} err - in case of errors, null otherwise.
 * @param {Location} location - stored location.
 */

    /** Publish data to the cloud.
     * @param {array(PubData)|PubData} entries - data to publish.
     * @param {cb:publishData} cb - optional, callback to get the response
     */
    RestClient.prototype.publishData = function(params, cb){
        var p = params; // shortcut
        checkParams(p, { entries:'mandatory' });
        var a = p.entries;
        a = isArray(a) ? a.slice() : [a]; // ensure it's an array, and eventually clone
        for (var i=0; i<a.length; i++) {
            checkParams(a[i], { data:'mandatory', channel:'mandatory,channel', 'at,expire_at':'timestamp', ttl:'number', id:'string' });
        }
        this._log('publish data');
        a = (a.length===1) ? a[0] : a; // explode a single item
        return this.request({ method:'PUT', uri:'data', body:a }, cb||p);
    };//publishData
/**
 * @callback cb:publishData
 * @param {Error} err - in case of errors, null otherwise.
 * @param {array(Oid)|Oid} ids - IDs assigned to the published data.
 */


    /** Retrieve published data.
     * @param {ChMask} channel_mask - from what channel(s) should the data be retrieved.
     * @param {PlugId} of - optional, limit data to the specified publisher. You can specify multiple publishers separating them with commas.
     * @param {Timestamp|Oid} before - optional, limit data to that published before the specified time or ID.
     * @param {Timestamp|Oid} after - optional, limit data to that published after the specified time or ID.
     * @param {Timestamp|array(Timestamp)} at - optional, get solely data published at specified time. You can also specify different times with commas.
     * @param {number} offset - optional, the result won't include the first entries. Useful in pagination.
     * @param {number} limit - optional, the result won't be longer than the specified number of entries. Useful in pagination.
     * @param {cb:retrieveData} cb - optional, callback to get the response
     */
    RestClient.prototype.retrieveData = function(params, cb){
        var p = params; // shortcut
        checkParams(p, { channel_mask:'mandatory,channel mask', of:'csv plugidpub', 'before,after':'timestamp|oid', at:'csv timestamp', 'offset,limit':'number,positive' });
        this._log('retrieve data');
        return this.request({ method:'GET', uri:'data/'+escChannel(p.channel_mask)+getFilters(p,'before,after,at,of,offset,limit') }, cb||p);
    };//retrieveData
/**
 * @callback cb:retrieveData
 * @param {Error} err - in case of errors, null otherwise.
 * @param {array(Oid)|Oid} ids - IDs assigned to the published data.
 */

    /** Delete data published on the cloud.
     * @param {ChMask} channel_mask - in what channel(s) is the data stored.
     * @param {PlugId} of - optional, limit action to the data published by the specified publisher. You can specify multiple publishers separating them with commas.
     * @param {Timestamp|Oid} before - optional, limit action to the data published before the specified time or ID.
     * @param {Timestamp|Oid} after - optional, limit action to the data published after the specified time or ID.
     * @param {Timestamp|array(Timestamp)} at - optional, specify exactly what data to delete. You can also specify different times with commas.
     * @param {Oid|array(Oid)} id - optional, specify exactly what data to delete.
     * @param {cb:removeData} cb - optional, callback to get the response
     */
    RestClient.prototype.removeData = function(params, cb){
        var p = params; // shortcut
        checkParams(p, { channel_mask:'channel mask', of:'csv plugidpub', 'before,after':'timestamp|oid', at:'csv timestamp', id:'oid|[oid]', 'id,before,after,at':'some' });
        this._log('retrieve data');
        return this.request({ method:'DELETE', uri:'data/'+escChannel(p.channel_mask||'#'), body:minus(p,'channel_mask') }, cb||p);
    };//retrieveData
/**
 * @callback cb:removeData
 * @param {Error} err - in case of errors, null otherwise.
 * @param {number} n - number of data entries successfully deleted.
 */

    /** Retrieve a list of channels containing data.
     * @param {ChMask} channel_mask - limit the list to the channels complying the specified mask.
     * @param {PlugId} of - optional, limit channels to the specified publisher. You can specify multiple publishers separating them with commas.
     * @param {Timestamp|Oid} before - optional, limit channels of data that published before the specified time or ID.
     * @param {Timestamp|Oid} after - optional, limit channels of data that published after the specified time or ID.
     * @param {Timestamp|array(Timestamp)} at - optional, get solely channels of data published at specified time. You can also specify different times with commas.
     * @param {number} offset - optional, the result won't include the first entries. Useful in pagination.
     * @param {number} limit - optional, the result won't be longer than the specified number of entries. Useful in pagination.
     * @param {cb:getChannels} cb - optional, callback to get the response
     */
    RestClient.prototype.getChannels  = function(params, cb){
        var p = params; // shortcut
        checkParams(p, { channel_mask:'mandatory,channel mask', of:'csv plugidpub', 'before,after':'timestamp|oid', at:'csv timestamp', 'offset,limit':'number,positive'  });
        this._log('retrieve data');
        return this.request({ method:'GET', uri:'channel/'+escChannel(p.channel_mask||'#')+getFilters(p,'before,after,at,of,offset,limit') }, cb||p);
    };//getChannels
/**
 * @callback cb:getChannels
 * @param {Error} err - in case of errors, null otherwise.
 * @param {array(string)} channels - list of channels according to the query.
 */

    /** Handle every request to the server.
     * @private
     * @param {boolean} master - enforce master authorization. False by default.
     * @param {boolean} auth - enforce any authorization. True by default.
     * @param {boolean} postOnly - override this.postOnly
     * @param {string} method - HTTP method (uppercase)
     * @param {string} uri - URI
     * @param body - value of the body, will be automatically encoded as JSON
     * @param {cb:simple} cb - optional, callback to get the response
     * @returns request object
     */
    RestClient.prototype.request = function(params, cb) {
        var p = params; // shortcut
        assert(p, 'missing parameters');
        if (p.auth === undefined) p.auth = true;
        assert(p.master ? this._isMaster : (p.auth===false || this._plugId || this._email), 'missing credentials');

        var url = this._baseUrl+p.uri;

        var headers = !this._pwd ? {}
            : this._isMaster ? expand({'X-Plug-Master':this._pwd}, this._plugId ? {'X-Plug-Id':this._plugId} : {'X-Plug-Email':this._email })
            : { 'X-Plug-Id': this._plugId, 'X-Plug-Auth':this._pwd };
        if ((this.postOnly||p.postOnly) && p.method !== 'POST') expand(headers, {
            'X-HTTP-Method-Override': p.method
        });
        expand(headers, { 'Content-type':'application/json' });

        var me = this;
        var body = JSON.stringify(p.body);
        cb = cb ? (cb.cb||cb) : p.cb;
        if (!(cb instanceof Function))
            cb = undefined;

        this._log('REQUEST: '+p.method+' '+ p.uri, p.body);

        if (!isBrowser) {
            var req = require('url').parse(url,false,true);
            expand(req, { method:p.method, headers:headers, agent:this._agent });

            req = this._http.request(req, function(res){
                var body = '';
                res.on('data', function(chunk){
                    body += chunk;
                });
                res.on('end', function(){
                    handleResponse({
                        status: res.statusCode,
                        //headers: res.headers,
                        body: body
                    });
                });
            });
            req.end(body);
            req.on('error', function(e) {
                console.error(e);
            });
            return req;
        }

        return ajax({
            method: this.postOnly ? 'POST' : p.method,
            url: url,
            headers: headers,
            body: body, // this skips any function, thus also 'cb'
            cb: function(xhr){
                handleResponse({
                    status: xhr.status,
                    //headers: xhr.getAllResponseHeaders(),
                    body: xhr.responseText
                });
            }
        });

        function handleResponse(res) {
            var body = res.body;

            if (me._debug) me._log('RESPONSE: '+res.status+' '+p.method+' '+ p.uri, body);

            try { body=JSON.parse(body) }
            catch(e){}
            var err = (res.status >= 200 && res.status < 300) ? null : Error('HTTP status '+ res.status);

            cb && cb(err, body);
        }//handleResponse
    };//request

    //** @private log utility
    RestClient.prototype._log = function(text,more){
        if (!text || !this._debug) return;
        if (!isBrowser) console = require('util');
        if (more)
            console.log('cpREST: '+text, more);
        else
            console.log(isString(text) ? 'cpREST: '+text : text);
    }//_log

    //// UTILITIES

    // series of functions to check data type and form
    function isPlugId(s) { return /(dev|com|mod)-.+/.test(s) }
    function isPlugIdPub(s) { return /(dev|com)-.+/.test(s) }
    function isPlugIdMod(s) { return /mod-.+/.test(s) }
    function isValidPassword(s) { return s }
    function isChannel(s) { return /^(?:[^/+#]+\/)*[^/+#]+$/.test(s) }
    function isChannelMask(s) { return /^(?:(?:[^/+#]+|\+)\/)*(?:[^/+#]+|\+|\#)$/.test(s) }
    function isUrl(s) { return /^(((https?):)?\/\/([^@]+@)?)?[-A-Z0-9.]+(:\d+)?(\/.*)?$/i.test(s) }
    function isEmail(s) { return typeof s==='string' && s.indexOf('@')>0 }
    function isNumeric(s) { return (typeof s === 'number' || typeof s === 'string' && s===+s) && isFinite(+s) }
    function isString(s) { return typeof s === 'string' }
    function isOid(s) { return /[0-9a-f]{24}/i.test(s) }

    // convert any Timestamp to the same format (milliseconds)
    function normalizeTs(v) { return v instanceof Date || isNumeric(v) ? +v : isString(v) ? Date.parse(v) : false }

    // clone a whole object, or just the specified fields (array or CSV). If an object is supplied to 'andExpand', expand() is called accordingly.
    function clone(obj, fields/*optional*/, andExpand) {
        if (typeof fields === 'string') fields = fields.split(',');
        assert(!fields || isArray(fields), 'bad params');
        var ret = {};
        if (fields) {
            for (var a=fields,i=0,n=a.length; i<n; i++) {
                var k = a[i];
                if (!obj.hasOwnProperty(k)) continue;
                ret[k] = obj[k];
            }
        }
        else {
            for (var k in obj) {
                if (!obj.hasOwnProperty(k)) continue;
                ret[k] = obj[k];
            }
        }
        if (andExpand)
            expand(ret, andExpand);
        return ret;
    }//clone

    // adds more properties to an object
    function expand(obj,more) {
        if (more) for (var k in more) {
            if (!more.hasOwnProperty(k)) continue;
            obj[k] = more[k];
        }
        return obj;
    }//expand

    // like expand, but creates a new object instead of changing this one
    function plus(obj,more){ return expand(clone(obj), more) }

    // create a new object same as 'obj' but without the specified fields (array or CSV)
    function minus(obj,fields){
        if (typeof fields === 'string') fields = fields.split(',');
        var ret = {};
        for (var k in obj) {
            if (obj.hasOwnProperty(k)
            && fields.indexOf(k)<0)
                ret[k] = obj[k];
        }
        return ret;
    }//minus

    // call a function with specified arguments
    function call(f, args) {
        if (f instanceof Function)
            return f.apply(this, args);
    }//call

    // create a new object with single key:value
    function newObj(k,v) {
        var ret = {};
        ret[k] = v;
        return ret;
    }//newObj

    function assert(condition, message) {
        if (!condition) throw Error('ASSERT failed'+ (message ? ': '+message : ''));
    } // assert

    function idFun(x){ return x }

    // escape channel for URL usage
    function escChannel(s) {
        return encodeURI(s).replace(/[?#]/g, function(v){ return '%'+v.charCodeAt(0).toString(16) });
    }//escChannel

    // build the filter part of the url with the specified 'fields' of 'obj'. Fields can be array or CSV.
    function getFilters(obj, fields) {
        if (isString(fields)) fields = fields.split(',');
        var filters = fields.map(function(k){
            return obj[k] && k+'='+encodeURIComponent(obj[k])
        }).filter(idFun).join('&');
        return (filters ? '?'+filters : '');
    }//getFilters

    // ensure a value is an array, or encapsulate it in an array. If 'sep' is passed, then a string will be split with it.
    function wantArray(v, sep) {
        return isArray(v) ? v
            : sep ? v.split(sep)
            : [v]
    }//wantArray

    isArray = Array.isArray || function(v){ return v instanceof Array };
    isString = function(v){ return typeof v === 'string' };

    // enforces some rules, like presence and type
    function checkParams(obj, rules) {
        assert(obj===undefined || obj instanceof Object && obj!==null, 'parameters must be passed as an object');
        for (var fields in rules) {
            // single field rules
            fields.split(',').forEach(function(f) {
                rules[fields].split(',').forEach(function(rule) {
                    var v = obj && obj[f];
                    var there = v !== undefined; // sometimes is useful to consider undefined as they are not there
                    if (rule === 'mandatory') return assert(there, 'missing parameter: ' + f);
                    if (!there) return;
                    switch (rule) {
                        case 'channel': return assert(isChannel(v), 'invalid channel: '+f+'='+v);
                        case 'channel mask': return assert(isChannelMask(v), 'invalid channel mask: '+f+'='+v);
                        case 'plugidpub': return assert(isPlugIdPub(v), 'invalid plug-id: '+f+'='+v);
                        case 'plugidmod': return assert(isPlugIdMod(v), 'invalid plug-id: '+f+'='+v);
                        case 'plugidpub|email': return assert(isPlugIdPub(v) || isEmail(v), 'invalid parameter: '+f+'='+v);
                        case 'plugidpub|[plugidpub]': return assert(isPlugIdPub(v) || isArray(v) && v.every(isPlugIdPub), 'invalid plug-id: '+f+'='+v);
                        case 'password': return assert(isValidPassword(v), 'invalid password');
                        case 'csv plugidpub':
                            assert(wantArray(v,',').every(isPlugId), 'invalid plug-id: '+f+'='+v);
                            if (isArray(v)) obj[f] = v.join(',');
                            return;
                        case '[oid]':
                            if (isString(v)) obj[f] = v = v.split(','); // cast
                            return assert(v.every(isOid), 'invalid parameter: '+f+'='+v);
                        case 'oid|[oid]': return assert(wantArray(v).every(isOid), 'invalid parameter: '+f+'='+v);
                        case 'url': return assert(isUrl(v), 'invalid URL: '+f+'='+v);
                        case 'boolean': return obj[f] = !!v;
                        case 'string':
                        case 'number':
                            // possible cast
                            var type = typeof v;
                            obj[f] = (rule==='string' && type==='number') ? ""+v
                                : (rule==='number' && type==='string') ? +v
                                : v;
                            // type check
                            return assert(type===rule, 'invalid parameter: '+f);
                        case 'positive': return assert(v>=0, 'invalid parameter: '+f);
                        case 'timestamp': return assert((obj[f]=normalizeTs(v)) !== false, 'invalid parameter: '+f);
                        case 'timestamp|oid': return assert(isOid(v) || (obj[f]=normalizeTs(v))!==false, 'invalid paramter: '+f);
                        case 'csv timestamp':
                            // normalize to array
                            if (isString(v))
                                v = v.split(',')
                            // check single elements
                            if (isArray(v)) {
                                v = obj[f] = v.map(function(e){
                                    return normalizeTs(e) || assert('invalid timestamp: '+e)
                                }).join(',');
                            }
                            return assert(isString(v), 'invalid timestamps: '+f);
                        case 'some': return; // ignore multi-field rules
                        default: assert(0,'unrecognized rule: '+rule);
                    }
                });
            });
            //multi-field rules
            fields = fields.split(',');
            rules[fields].split(',').forEach(function(rule){
                switch (rule) {
                    case 'some': return assert(fields.some(function(f){ return obj && obj[f]!==undefined }), 'at least one of these fields is required: '+fields);
                }
            });
        }
    }//checkParams

    /** Simple XHR wrapper
     * @private
     */
    if (isBrowser)
    function ajax(params){
        var p = params;
        assert(p, 'missing parameters');

        try {
            var xhr = window.ActiveXObject ? new ActiveXObject('Microsoft.XMLHTTP') : new XMLHttpRequest()
        }
        catch(e){
            return false;
        }
        
        xhr.onreadystatechange = function(){
            if (!p.cb) return;
            if (xhr.readyState==4)
                p.cb(xhr);
        };
        xhr.timeout = p.timeout;
        xhr.ontimeout = p.onTimeout;
        xhr.upload = p.onUpload;

        var url = p.url;
        if (p.cache === false)
            url += ((url.indexOf('?')<0) ? '?_' : '&_') + Date.now();

        xhr.open(p.method || (p.body ? 'POST' : 'GET'), url, !p.sync);
        var h = p.headers || {};
        for (var k in h) {
            xhr.setRequestHeader(k, h[k]);
        }
        xhr.send(p.body);
        return xhr;
    }//ajax

})();

/**
 * Permissions descriptor. What data can be read and/or written by this device and its controllers.
 * @typedef {object} Perm
 * @property {object} of - permissions of this device to access data.
 * @property {PlugFilter} of.r - of what devices we can read data and properties
 * @property {PlugFilter} of.w - of what devices we can write data and properties
 * @property {string} ctrl - permissions a controller will get when requesting control of this device. Possible values are
 * <li>null or "rw": read & write
 * <li>"r": read only
 * <li>"": no permission
 */

/**
 * Denotes a list of devices by specifying their plug-ids as string in an array. If null it means all devices.
 * @typedef {array} PlugFilter
 */

/**
 * Allowed values are
 * <li>"ok": the device can authenticate normally.
 * <li>"disabled": the device is present in our system but it's not allowed to connect and use the services.
 * <li>"reactivate": the device's previous authentication token was revoked and needs to activate again.
 * @typedef {string} Status
 */

/** Device's general information
 * @typedef {object} Device
 * @property {string} name - a descriptive name.
 * @property {Perm} perm - permissions of this device and its controllers.
 * @property {Status} status - is the device enabled or not?
 * @property {object} props - custom properties, you can have any JSON valid value in it.
 */

/** Location information
 * @typedef {object} Location
 * @property {number} x - Longitude, in degrees. This value is in the range [-180, 180).
 * @property {number} y - Latitude, in degrees. This value is in the range [-90, 90].
 * @property {number} r - optional, accuracy in meters.
 * @property {number} z - optional, meters above mean sea level.
 * @property {Timestamp} t - optional, when data was sampled.
 */

/** Published data.
 * @typedef {object} PubData
 * @property {string} channel - channel where the data is stored.
 * @property data - the data itself, can be any JSON-compliant type.
 * @property {Timestamp} at - time of the data. Inside a channel, 'at' is key, that means you cannot put 2 different data with same time and channel. Attempting to do so will cause previous data to be overwritten.
 * @property {PlugId} of - publisher.
 * @property {Timestamp} expire_at - when data expires it is automatically deleted.
 * @property {number} ttl - a different way to set expiration, through the number of seconds to live.
 */

/** Time information. You can use standard Date object, number of milliseconds since Epoch, or an ISO string.
 * @typedef {number|Date|string} Timestamp
 */

/** A 24-digits hexadecimal string, identifying an entry in the database.
 * @typedef {string} Oid
 */

/** Any JSON-compliant value that's not an object.
 * @typedef {number|string|boolean|null} Primitive
 */

/** It's a string just like the channel name, but by using wildcards you can refer to multiple channels. For details see {@link http://www.cloudplugs.com/user-guide/concepts-and-definitions/what-are-wildcards/|the knowledge base at CloudPlugs.com}.
 * @typedef {string} ChMask
 */

/**
 * @callback cb:simple
 * @param {Error} err - in case of errors, null otherwise.
 */
