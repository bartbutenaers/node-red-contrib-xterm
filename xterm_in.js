/**
 * Copyright 2019 Bart Butenaers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    var settings = RED.settings;
    
    function XtermInNode(config) {
        RED.nodes.createNode(this, config);
        
        var node = this;
        
        node.on("input", function(msg) {
            // TODO deze payload naar de pseudo terminal writen
        });

        node.on("close", function() {
            if (done) {
                done();
            }
        });
    }

    RED.nodes.registerType("xterm_in", XtermInNode);
}
