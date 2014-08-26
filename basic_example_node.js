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

AUTH_PLUGID = 'dev-xxxxxxxxxxxxxxxxxx';
AUTH_PASS = 'your-password';
AUTH_MASTER = true;

var cloudplugs = require('./cp.rest.lib');
var client = new cloudplugs.RestClient({
    debug: true,
    id: AUTH_PLUGID,
    password: AUTH_PASS,
    isMaster: AUTH_MASTER
});
client.publishData({
    entries: [{ channel:'temperature', data:getTemp() }],
    cb: function(err,id) {
        console.log('Publication: '+(err ? 'failed' : 'successful'));
        if (err) {
            console.error(err);
        }
    }
});

function getTemp() {
    return Math.round(Math.random()*100)
}
