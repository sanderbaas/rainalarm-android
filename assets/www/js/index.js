var locations = [];
var geoLocation;
var autoRefreshInterval = 60000;
var autoRefreshId;

// Application Constructor
function initialize () {
  navigator.mozL10n.ready(function() {
    // fetch localStorage
    locations = JSON.parse(window.localStorage.getItem('locations')) || [];

    $(document).on('click','span.remove-loc', function(){
      removeLoc($(this).data('id'));
      $(this).closest('li').remove();
    });

    $(document).on('click','span.show-loc', function(){
      var lat = $(this).data('lat');
      var lon = $(this).data('lon');
      var desc = $(this).data('desc');
      setDefaultLoc($(this).data('id'));
      toggleSideMenu();
      run();
    });

    // Reload content
    var reload = document.querySelector("#reload");
    if (reload) {
      reload.onclick = function () {
        run();
      };
    };

    var btnAddLocation = document.querySelector("#add-location");
    var txtNewLocation = document.querySelector("#new-location");
    if (btnAddLocation) {
      btnAddLocation.onclick = function () {
        if (txtNewLocation.value !== '') {
          // fetch coordinates
          getCoords(txtNewLocation.value, function(err, lat, lon, desc) {
            if (err) {
              if (err.message === 'nothing found') {
                alerter(navigator.mozL10n.get("location-not-found"));
                return;
              }

              alerter(err.message);
              return;
            }
            var newLoc = {
              id: Date.now(),
              desc: desc,
              lat: lat,
              lon: lon
            };
            addLocation(newLoc);
            addLocElement(newLoc);
            txtNewLocation.value = '';
          });
        }
      };
    }

    var btnCurrentLocation = document.querySelector("#current-location");
    if (btnCurrentLocation) {
      btnCurrentLocation.onclick = function () {
        toggleWaiter(true);
        var timeoutLocation = function timeoutLocation() {
          toggleWaiter(false);
          alerter(navigator.mozL10n.get("timeout-location-message"));
        };

        var timeoutGeo = window.setTimeout(timeoutLocation, 60000);

        navigator.geolocation.getCurrentPosition(function (position) {
          window.clearTimeout(timeoutGeo);

          getAddress(position.coords.latitude, position.coords.longitude, function(err, description) {
            if (err) {
              showNotification(err);
              toggleWaiter(false);
              return;
            }
            toggleSideMenu();
            geoLocation = {
              lat: position.coords.latitude,
              lon: position.coords.longitude,
              desc: description,
              default: true
            };
            run(geoLocation);
          });
        },
        function (err) {
          window.clearTimeout(timeoutGeo);
          toggleWaiter(false);
          alerter(navigator.mozL10n.get("error-location-message"));
        }, {
          enableHighAccuracy: true
        });
      };
    }

    // Settings
    var menu = document.querySelector("#menu");
    if (menu) {
      menu.onclick = function () {
        toggleSideMenu();
      };
    }

    locations.forEach(function(location){
      addLocElement(location);
    });

    run();
    initAutoRefresh();
  });
}

function toggleWaiter(visible) {
  if (visible && !$('#reload').hasClass('spinning')) {
    $('#reload').addClass('spinning');
    return;
  }

  if ($('#reload').hasClass('spinning')) {
    $('#reload').removeClass('spinning');
    return;
  }
}

function alerter(message, alertCallback, title, buttonName) {
  if (navigator.notification) {
    navigator.notification.alert(message, alertCallback, title, buttonName);
    return;
  }

  alert(message);
}

function toggleSideMenu() {
  var gotoLeft = "0rem";
  if (parseInt($('#sidemenu').css('left')) == 0) { gotoLeft = "-30rem"; }
  $('#sidemenu').animate({
    left: gotoLeft
  }, 500, function() { });
}

function removeLoc(id) {
  var newLocations = [];
  locations.forEach(function(loc) {
    if (loc.id !== id) { newLocations.push(loc); }
  });
  locations = newLocations;
  window.localStorage.setItem('locations', JSON.stringify(locations));
}

function addLocation(obj) {
  locations.push(obj);
  window.localStorage.setItem('locations', JSON.stringify(locations));
}

function setDefaultLoc(id) {
  if (geoLocation) {
    geoLocation.default = false;
  }
  locations.forEach(function(loc) {
    loc.default = !(loc.id !== id);
  });
  window.localStorage.setItem('locations', JSON.stringify(locations));
}

function getStandardLoc() {
  return {
    lat: 52.1100,
    lon: 5.1806,
    desc: 'De Bilt'
  };
}

function getDefaultLoc() {
  if (geoLocation && geoLocation.default && geoLocation.default === true) {
    return geoLocation;
  }

  var result;
  locations.forEach(function(loc) {
    if (loc.default === true) { result = loc; return; }
  });
  if (result) { return result; }
  return getStandardLoc();
}

function addLocElement(loc) {
  var locLi = $('#locs').append('<li class="loc"><span class="show-loc" data-id="'+loc.id+'" data-lat="'+loc.lat+'" data-lon="'+loc.lon+'" data-desc="'+loc.desc+'">'+loc.desc+'</span> <span class="remove-loc" data-id="'+loc.id+'">\uf014</span></li>');
}

function getCoords(query, cb) {
  var url = 'https://nominatim.openstreetmap.org/search?q='+query+'&format=json&addressdetails=1&countrycodes=nl';
  var xhr = new XMLHttpRequest({mozSystem: true});
  xhr.open('GET', url, true);
  xhr.onreadystatechange = function () {
    if (xhr.status === 200 && xhr.readyState === 4) {
      var allData = JSON.parse(xhr.response);
      if (!(allData && Object.prototype.toString.call(allData) === '[object Array]' && allData.length > 0)) {
        cb(new Error('nothing found'));
        return;
      }
      var data = allData[0];
      var locName = parseAddress(data);
      var lat = data.lat;
      var lon = data.lon;
      cb(null, lat, lon, locName);
      return;
    }
  };

  var that = this;

  xhr.onerror = function (err) {
    showNotification(navigator.mozL10n.get("error-fetching-address-message"));
  };
  xhr.send();
}

function parseAddress(data) {
  var addressParts = [];
  var houseNumber;
  var ignoreKeys = [
    'residential',
    'county',
    'state',
    'country',
    'neighbourhood'
  ];

  if (data && data.address) {
    // all parts until suburb or else city
    Object.keys(data.address).some(function(key){
      if (key === 'house_number') {
        houseNumber = data.address[key];
      } else {
        if (ignoreKeys.indexOf(key) === -1) {
          addressParts.push(data.address[key]);
        }
      }

      return (key === 'suburb' || key === 'city');
    });

    // squeeze house_number in second place of not commercial
    if (houseNumber && ['commercial'].indexOf(data.type)===-1) {
      addressParts.splice(1, 0, houseNumber);
    }
  }
  return addressParts.join(' ');
}

function getAddress (lat, lon, cb) {
  var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat='+lat+'&lon='+lon+'&zoom=18&addressdetails=1';
  var xhr = new XMLHttpRequest({mozSystem: true});
  xhr.open('GET', url, true);
  xhr.onreadystatechange = function () {
    if (xhr.status === 200 && xhr.readyState === 4) {
      var data = JSON.parse(xhr.response);
      var locName = parseAddress(data);
      cb(null, locName);
      return;
    }
  };

  xhr.onerror = function (err) {
    cb(navigator.mozL10n.get("error-fetching-address-message"));
  };
  xhr.send();
}

function getCurrentWeather (lat, lon, cb){
  var url = 'http://api.openweathermap.org/data/2.5/weather?lat='+lat+'&lon='+lon+'&appid=fbc3d19917801786e46dbacd55d2ee9c';
  var xhr = new XMLHttpRequest({mozSystem: true});
  xhr.timeout = 3000;
  xhr.open('GET', url, true);
  xhr.onreadystatechange = function () {
    if (xhr.status === 200 && xhr.readyState === 4) {
      var data = JSON.parse(xhr.responseText);
      cb(null, data);
      return;
    }

    if (xhr.status !== 200 && xhr.readyState === 4) {
      cb(null, {});
    }
  };

  xhr.onerror = function (err) {
    cb(err);
  };

  xhr.ontimeout = function (err) {
    cb('timout');
  };
  xhr.send();
}

function getLiveData (lat, lon, cb) {
  var url = 'https://gratisweerdata.buienradar.nl/data/raintext?lat='+lat+'&lon='+lon;
  var xhr = new XMLHttpRequest();
  xhr.timeout = 3000;
  xhr.open('GET', url, true);
  xhr.onreadystatechange = function () {
    if (xhr.status === 200 && xhr.readyState === 4) {
      var sets = [];
      var labels = []; // mm/per hour = 10^((value -109)/32)
      var lines = xhr.response.trim().split("\n");
      lines.forEach(function(line) {
        var parts = line.trim().split('|');
        var perc = '000';
        if (parts[0] !== '') { perc = parts[0]; }
        var mm = Math.pow(10, (parseInt(perc)-109)/32);
        labels.push(parts[1]);
        sets.push([parts[1],mm])
      });
      cb(null, sets);
    }
  };

  xhr.onerror = function (err) {
    cb(navigator.mozL10n.get("error-fetching-rain-message"));
  };

  xhr.ontimeout = function (err) {
    cb('timout');
  };
  xhr.send();
}

function getTestData(lat, lon, cb) {
  var dt = new Date();
  dt.setMinutes(Math.floor(dt.getMinutes()/5)*5);

  var sets = [];
  for (i=0; i<25; i++) {
    sets.push([dt.getHours() + ':' + (dt.getMinutes()<10 ? '0' : '') + dt.getMinutes(), Math.random()*(5*Math.random())]);
    dt.setMilliseconds(dt.getMilliseconds() + 5*60*1000);
  }

  cb(null, sets);
}

function draw(data, description, weather) {
  $('#error-display').hide();

  var x = [];
  var precipitation = [];
  data.forEach(function(pair){
    var dt = new Date();
    x.push(pair[0]);
    precipitation.push(pair[1]);
  });

  var chart = c3.generate({
    bindto: '#graph',
    padding: {
      top: 60,
      left: 10,
      right: 10
    },
    data: {
        columns: [
            ['precipitation'].concat(precipitation)
        ],
        types: {
            precipitation: 'area-spline'
        }
    },
    legend: {
      show: false
    },
    color: {
      pattern: ['#47E0FF']
    },
    axis: {
        x: {
          type: 'categories',
          categories: x,
          tick: {
            count: 5,
            fit: true
          }
        },
        y: {
          padding: { top: 0 },
          show: false,
          max: Math.max(4, Math.max.apply(Math, precipitation))
        }
    },
    grid: {
      y: {
        lines: [
          {value: 0.3, position: 'start', class: 'line-light-rain', text: navigator.mozL10n.get("light-rain")},
          {value: 1.3, position: 'start', class: 'line-medium-rain', text: navigator.mozL10n.get("medium-rain")},
          {value: 2.5, position: 'start', class: 'line-heavy-rain', text: navigator.mozL10n.get("heavy-rain")}
        ]
      }
    },
    point: {
      show: false
    },
    tooltip: {
      format: {
        value: function (value, ratio, id) {
          return d3.round(value,1) + ' mm/h';
        }
      },
      position: function (data, width, height, element) {
        var gWidth = $('#graph').width();
        return {top: 10, left: gWidth - width -10}
      }
    }
  });

  var textDescription = d3.select('svg').append('text')
    .attr('x', 10 )
    .attr('y', 20)
    .attr('class', 'locationTitle')
    .text(description);

  var textWeather = d3.select('svg').append('text')
    .attr('x', 10 )
    .attr('y', 40);

  if (weather.weatherIcon) {
    textWeather.append('svg:tspan').attr('class','wi weatherIcon').text(weather.weatherIcon);
  }

  if (weather.temp) {
    textWeather.append('svg:tspan').attr('class','temp').text('\u00a0' + weather.temp + '\u00a0' + '\u2103' + '\u00a0\u00a0');
  }

  if (weather.windIcon) {
    textWeather.append('svg:tspan').attr('class','wi windIcon').text(weather.windIcon).attr('y',42);
  }

  if (weather.windBft) {
    textWeather.append('svg:tspan').attr('class','windBft').text('\u00a0' + weather.windBft + '\u00a0' + 'Bft').attr('y',40);
  }

  if (data.every(function(element, index, array) {
    return Math.round(10*element[1]) == 0;
  })) {
    var textNoRain = d3.select('svg').append('text')
    .attr('x', 10 )
    .attr('y', 60)
    .attr('class', 'noRain')
    .text(navigator.mozL10n.get("no-rain"));
  }
}

function windMsToBft(windMs) {
  if (windMs >= 0 && windMs < 0.3) {
    return 0;
  }
  if (windMs >= 0.3 && windMs < 1.6) {
    return 1;
  }
  if (windMs >= 1.6 && windMs < 3.4) {
    return 2;
  }
  if (windMs >= 3.4 && windMs < 5.5) {
    return 3;
  }
  if (windMs >= 5.5 && windMs < 8) {
    return 4;
  }
  if (windMs >= 8 && windMs < 10.8) {
    return 5;
  }
  if (windMs >= 10.8 && windMs < 13.9) {
    return 6;
  }
  if (windMs >= 13.9 && windMs < 17.2) {
    return 7;
  }
  if (windMs >= 17.2 && windMs < 20.8) {
    return 8;
  }
  if (windMs >= 20.8 && windMs < 24.5) {
    return 9;
  }
  if (windMs >= 24.5 && windMs < 28.5) {
    return 10;
  }
  if (windMs >= 28.5 && windMs < 32.7) {
    return 11;
  }
  if (windMs >= 32.7) {
    return 12;
  }
}

function tempKtoC(tempK) {
  return Math.round(tempK - 273.15);
}

function convertIcon(icon, unicode) {
  switch (icon) {
    case '01d':
      return unicode ? '\uf00d' : 'wi-day-sunny';
    case '02d':
      return unicode ? '\uf00c' : 'wi-day-sunny-overcast';
    case '03d':
      return unicode ? '\uf013' : 'wi-cloudy';
    case '04d':
      return unicode ? '\uf013' : 'wi-cloudy';
    case '09d':
      return unicode ? '\uf01a' : 'wi-showers';
    case '10d':
      return unicode ? '\uf009' : 'wi-day-showers';
    case '11d':
      return unicode ? '\uf01d' : 'wi-storm-showers';
    case '13d':
      return unicode ? '\uf01b' : 'wi-snow';
    case '50d':
      return unicode ? '\uf014' : 'wi-fog';
    case '01n':
      return unicode ? '\uf02e' : 'wi-night-clear';
    case '02n':
      return unicode ? '\uf031' : 'wi-night-cloudy';
    case '03n':
      return unicode ? '\uf013' : 'wi-cloudy';
    case '04n':
      return unicode ? '\uf013' : 'wi-cloudy';
    case '09n':
      return unicode ? '\uf01a' : 'wi-showers';
    case '10n':
      return unicode ? '\uf037' : 'wi-night-showers';
    case '11n':
      return unicode ? '\uf01d' : 'wi-storm-showers';
    case '13n':
      return unicode ? '\uf01b' : 'wi-snow';
    case '50n':
      return unicode ? '\uf014' : 'wi-fog';
    }
}

function windDegToIcon(degrees, border) {
  var deg = degrees || 0;
  if (deg < 0) { deg += 360; }
  if (deg >= 360) { deg -= 360; }

  // north
  if (deg >= 337.5 && deg < 360 || deg >= 0 && deg < 22.5) { return '\uf044'; }
  // north-east
  if (deg >= 22.5 && deg < 67.5) { return '\uf043'; }
  // east
  if (deg >= 67.5 && deg < 112.5) { return '\uf048'; }
  // south-east
  if (deg >= 112.5 && deg < 137.5) { return '\uf087'; }
  // south
  if (deg >= 137.5 && deg < 202.5) { return '\uf058'; }
  // south-west
  if (deg >= 202.5 && deg < 247.5) { return '\uf057'; }
  // west
  if (deg >= 247.5 && deg < 292.5) { return '\uf04d'; }
  // north-west
  if (deg >= 292.5 && deg < 337.5) { return '\uf088'; }
}

function convertWeatherData(data) {
  var result = {
    darkness: false
  };

  if (data.dt && data.sys && data.sys.sunrise && data.sys.sunset) {
    if (data.dt < data.sys.sunrise || data.dt > data.sys.sunset) {
      result.darkness = true;
    }
  }

  if (data.wind && data.wind.speed && data.wind.deg) {
    result.windBft = windMsToBft(data.wind.speed);
    result.windIcon = windDegToIcon(data.wind.deg);
  }

  if (data.main && data.main.temp) {
    result.temp = tempKtoC(data.main.temp);
  }

  if (data.weather && data.weather[0] && data.weather[0].icon) {
    result.weatherIcon = convertIcon(data.weather[0].icon, true);
  }

  return result;
}

function showNotification(message) {
  $('#error-display').html('<p>'+message+'</p>');
  $('#error-display').show();
}

function run (loc){
  $('html, body').animate({ scrollTop: 0 }, 'slow');
  toggleWaiter(true);
  var location = loc || getDefaultLoc();

  getLiveData(location.lat, location.lon, function(err, rainData) {
    if (err) {
      showNotification(err);
      toggleWaiter(false);
      return;
    }

    getCurrentWeather(location.lat, location.lon, function(err, weatherData) {
      var weather = {};
      if (!err) {
        weather = convertWeatherData(weatherData);
      }
      draw(rainData, location.desc, weather);
      toggleWaiter(false);
    });
  });
}

function initAutoRefresh() {
  autoRefreshId = setInterval(function(){ run(); }, autoRefreshInterval);
}

function clearAutoRefresh() {
  clearInterval(autoRefreshId);
}

function resume() {
  run();
  initAutoRefresh();
}

function pause() {
  clearAutoRefresh();
}



if (document.URL.indexOf( 'http://' ) === -1 && document.URL.indexOf( 'https://' ) === -1) {
  // PhoneGap application
  document.addEventListener('deviceready', initialize, false);
  document.addEventListener('resume', resume, false);
  document.addEventListener('pause', pause, false);
} else {
  // Web page
  document.onload = initialize();
}