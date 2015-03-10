/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        // Reload content
        var reload = document.querySelector("#reload");
        if (reload) {
          reload.onclick = function () {
            app.run();
          };
        }
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        //app.receivedEvent('deviceready');
        app.run();
    },
    run: function(){
      /*
            Regenalarm
        */
        var showNotification = function (message) {
          $('#error-display').html('<p>'+message+'</p>');
          $('#error-display').show();
        };

        var getAddress = function getAddress(lat, lon, cb) {
          var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat='+lat+'&lon='+lon+'&zoom=18&addressdetails=1';
          var xhr = new XMLHttpRequest({mozSystem: true});
          xhr.open('GET', url, true);
          xhr.onreadystatechange = function () {
            if (xhr.status === 200 && xhr.readyState === 4) {
              var data = JSON.parse(xhr.response);
              var addressParts = [];
              if (data && data.address && data.address.house) {
                addressParts.push(data.address.house);
              } else {
                if (data && data.address && data.address.cycleway) { addressParts.push(data.address.cycleway); }
                if (data && data.address && data.address.road) { addressParts.push(data.address.road); }
                if (data && data.address && data.address.house_number) { addressParts.push(data.address.house_number); }
              }
              if (data && data.address && data.address.city) { addressParts.push(data.address.city); }
              if (data && data.address && data.address.town) { addressParts.push(data.address.town); }

              var locName = addressParts.join(' ');
              cb(locName);
              return;
            }
          };

          xhr.onerror = function (err) {
            showNotification(
              navigator.mozL10n.get("error-fetching-address-message")
            );
          };
          xhr.send();
        };

        var getLiveData = function getData(lat, lon, cb) {
          var url = 'http://gps.buienradar.nl/getrr.php?lat='+lat+'&lon='+lon;
          var xhr = new XMLHttpRequest({mozSystem: true});
          xhr.open('GET', url, true);
          xhr.onreadystatechange = function () {
            if (xhr.status === 200 && xhr.readyState === 4) {
	        	var sets = [];
	            var labels = []; // mm/per hour = 10^((value -109)/32)
	            var lines = xhr.response.trim().split("\n");
	            lines.forEach(function(line) {
	              var parts = line.trim().split('|');
	              var mm = Math.pow(10, (parseInt(parts[0])-109)/32);
	              labels.push(parts[1]);
	              sets.push([parts[1],mm])
	            });
	            cb(sets);
            }
          };

          xhr.onerror = function (err) {
            showNotification(
                navigator.mozL10n.get("error-fetching-rain-message")
            );
          };
          xhr.send();
        };

        var getTestData = function getData(cb) {
          var sets = [
            ['12:00',0],
            ['12:05',1],
            ['12:10',2],
            ['12:15',3],
            ['12:20',4],
            ['12:25',0],
            ['12:30',0],
            ['12:35',0],
            ['12:40',0],
            ['12:45',0],
            ['12:50',1],
            ['12:55',2],
            ['13:00',3],
            ['13:05',4],
            ['13:10',0],
            ['13:15',0],
            ['13:20',0],
            ['13:25',0],
            ['13:30',0],
            ['13:35',0],
            ['13:40',0],
            ['13:45',0],
            ['13:50',0],
            ['13:55',0],
            ['14:00',0],
          ];
          cb(sets);
        }

        var draw = function draw(data, description) {
          $('#error-display').hide();

          var chart = new Highcharts.Chart({
            chart: {
              renderTo: 'graph',
              type: 'area'
            },
            credits: {
              enabled: false
            },
            legend: {
              enabled: false
            },
            title: {
              text: description,
              align: 'left',
              style: {
                'font-weight': 'bold'
              }
            },
            subtitle: {
              text: '',
              style: {
                  display: 'none'
              }
            },
            xAxis: {
                type: 'category',
                labels: {
                  staggerLines: 1,
                  step: 12
                }
            },
            yAxis: {
                title: false,
                gridLineWidth: 0,
                minRange: 6,
                floor: 0,
                labels: {
                    enabled: false
                },
                plotLines: [{ // light rain
                  color: '#FDFF00',
                  width: 2,
                  value: 0.3,
                  label: {
                      text: navigator.mozL10n.get("light-rain"),
                      style: {
                          color: '#000000'
                      }
                  }
              }, { // medium rain
                  color: '#FF4E00',
                  width: 2,
                  value: 1.3,
                  label: {
                      text: navigator.mozL10n.get("medium-rain"),
                      style: {
                          color: '#000000'
                      }
                  }
              }, { // heavy rain
                  color: '#B90000',
                  width: 2,
                  value: 3.25,
                  label: {
                      text: navigator.mozL10n.get("heavy-rain"),
                      style: {
                          color: '#000000'
                      }
                  }
              }]
            },
            tooltip: {
              crosshairs: [true, true],
              followTouchMove: true,
              shared: true,
              pointFormat: '<b>{point.y:,.1f} mm</b><br/>'
            },
            plotOptions: {
                area: {
                    pointStart: 0,
                    marker: {
                        enabled: false,
                        symbol: 'circle',
                        radius: 2,
                        states: {
                            hover: {
                                enabled: true
                            }
                        }
                    }
                }
            },
            series: [{
                name: description,
                data: data,
                color: '#B2F2FF'
            }]
          });
        };

        var defaultGeo = {
            coords: {
                latitude: 52.1100,
                longitude: 5.1806
            },
            description: 'De Bilt'
        };

        getLiveData(defaultGeo.coords.latitude, defaultGeo.coords.longitude, function(data) {
          draw(data, defaultGeo.description);
        });

        var timeoutLocation = function timeoutLocation() {
          showNotification(
            navigator.mozL10n.get("timeout-location-message")
          );
        };

        var timeoutGeo = window.setTimeout(timeoutLocation, 10000);

        navigator.geolocation.getCurrentPosition(function (position) {
          window.clearTimeout(timeoutGeo);

          getAddress(position.coords.latitude, position.coords.longitude, function(description) {
            getLiveData(position.coords.latitude, position.coords.longitude, function(data) {
              draw(data, description);
            });
          });
        },
        function () {
          showNotification(
            navigator.mozL10n.get("error-location-message")
          );
        });
    },
    // Update DOM on a Received Event
    receivedEvent: function(id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        console.log('Received Event: ' + id);
    }
};

document.onload = app.initialize();