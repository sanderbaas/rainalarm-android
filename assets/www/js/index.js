var locations = [];
var geoLocation;
var autoRefreshInterval = 60000;
var autoRefreshId;

// Application Constructor
function initialize () {
  navigator.mozL10n.ready(function() {
    // fetch localStorage
    locations = JSON.parse(window.localStorage.getItem('locations')) || [];

    $(document).on('click','button.remove-loc', function(){
      removeLoc($(this).data('id'));
      $(this).closest('li').remove();
    });

    $(document).on('click','button.show-loc', function(){
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

        var timeoutGeo = window.setTimeout(timeoutLocation, 10000);

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
        function () {
          window.clearTimeout(timeoutGeo);
          toggleWaiter(false);
          alerter(navigator.mozL10n.get("error-location-message"));
        }, {
          maximumAge: 3000, timeout: 5000, enableHighAccuracy: false
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
  var locLi = $('#locs').append('<li class="loc"><h2>'+loc.desc+'</h2><button class="show-loc" data-id="'+loc.id+'" data-lat="'+loc.lat+'" data-lon="'+loc.lon+'" data-desc="'+loc.desc+'">'+navigator.mozL10n.get("button-show")+'</button> <button class="remove-loc" data-id="'+loc.id+'">'+navigator.mozL10n.get("button-remove")+'</button></li>');
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
  var url = 'http://api.openweathermap.org/data/2.5/weather?lat='+lat+'&lon='+lon;
  var xhr = new XMLHttpRequest({mozSystem: true});
  xhr.timeout = 3000;
  xhr.open('GET', url, true);
  xhr.onreadystatechange = function () {
    if (xhr.status === 200 && xhr.readyState === 4) {
      var data = JSON.parse(xhr.response);
      cb(null, data);
      return;
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
  var url = 'http://gps.buienradar.nl/getrr.php?lat='+lat+'&lon='+lon;
  var xhr = new XMLHttpRequest({mozSystem: true});
  xhr.timeout = 3000;
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

function getTestData(cb) {
  var sets = [
    ['12:00',0],
    ['12:05',1],
    ['12:10',1.1],
    ['12:15',1.2],
    ['12:20',1.4],
    ['12:25',1.5],
    ['12:30',1.4],
    ['12:35',1],
    ['12:40',0.4],
    ['12:45',0],
    ['12:50',1],
    ['12:55',1.5],
    ['13:00',2],
    ['13:05',2.5],
    ['13:10',3.5],
    ['13:15',4],
    ['13:20',4],
    ['13:25',3.5],
    ['13:30',2],
    ['13:35',1],
    ['13:40',0],
    ['13:45',0],
    ['13:50',0],
    ['13:55',0],
    ['14:00',0],
  ];
  cb(null, sets);
}

function draw(data, description, weatherData) {
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
        'font-weight': 'bold',
        backgroundColor:'#ccc'
      }
    },
    subtitle: {
      text: weatherData,
      align: 'left',
      useHTML: true,
      style: {
        fontSize: '150%',
        color: '#333'
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
    }],
    noData: {
    style: {
      fontWeight: 'bold',
      fontSize: '15px',
      color: '#333'
      }
    }
  });

  chart.hideNoData();

  if (data.every(function(element, index, array) {
    return Math.round(10*element[1]) == 0;
  })) {
    chart.showNoData(navigator.mozL10n.get("no-rain"));
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

function windDegTo15Deg(deg, correction) {
  if (correction) { deg += correction; }
  if (deg < 0) { deg += 360; }
  if (deg >= 360) { deg -= 360; }
  return Math.round(deg/15) * 15;
}

function tempKtoC(tempK) {
  return Math.round(tempK - 273.15);
}

function convertIcon(icon) {
  switch (icon) {
    case '01d':
      return 'wi-day-sunny';
    case '02d':
      return 'wi-day-sunny-overcast';
    case '03d':
      return 'wi-cloudy';
    case '04d':
      return 'wi-cloudy';
    case '09d':
      return 'wi-showers';
    case '10d':
      return 'wi-day-showers';
    case '11d':
      return 'wi-storm-showers';
    case '13d':
      return 'wi-snow';
    case '50d':
      return 'wi-fog';
    case '01n':
      return 'wi-night-clear';
    case '02n':
      return 'wi-night-cloudy';
    case '03n':
      return 'wi-cloudy';
    case '04n':
      return 'wi-cloudy';
    case '09n':
      return 'wi-showers';
    case '10n':
      return 'wi-night-showers';
    case '11n':
      return 'wi-storm-showers';
    case '13n':
      return 'wi-snow';
    case '50n':
      return 'wi-fog';
    }
}

function renderWeather(data) {
  var darkness = false;
  var temp = 0;
  var windBft = 0;
  var windDeg = 0;

  if (data.dt && data.sys && data.sys.sunrise && data.sys.sunset) {
    if (data.dt < data.sys.sunrise || data.dt > data.sys.sunset) {
      darkness = true;
    }
  }

  if (data.wind && data.wind.speed && data.wind.deg) {
    var windBft = windMsToBft(data.wind.speed);
    var windDeg = windDegTo15Deg(data.wind.deg, 135);

    $('#windBft').html(windBft);
    $('#windDeg').prop('class', 'fa fa-location-arrow _'+windDeg+'-deg');
  }

  if (data.main && data.main.temp) {
    var temp = tempKtoC(data.main.temp);
    $('#temp').html(temp);
  }

  if (data.weather && data.weather[0] && data.weather[0].icon) {
    var wiIcon = convertIcon(data.weather[0].icon);
    $('#weatherIcon').prop('class', 'wi ' + wiIcon);
  }
}

function generateWeatherHTML(data) {
  var darkness = false;
  var temp = 0;
  var windBft = 0;
  var windClasses = '';
  var iconClasses = '';

  if (data.dt && data.sys && data.sys.sunrise && data.sys.sunset) {
    if (data.dt < data.sys.sunrise || data.dt > data.sys.sunset) {
      darkness = true;
    }
  }

  if (data.wind && data.wind.speed && data.wind.deg) {
    var windBft = windMsToBft(data.wind.speed);
    var windDeg = windDegTo15Deg(data.wind.deg, 135);
    windClasses = 'fa fa-location-arrow _'+windDeg+'-deg';
  }

  if (data.main && data.main.temp) {
    var temp = tempKtoC(data.main.temp);
  }

  if (data.weather && data.weather[0] && data.weather[0].icon) {
    var wiIcon = convertIcon(data.weather[0].icon);
    iconClasses = 'wi ' + wiIcon;
  }

  var html = '<span class="infoIcon"><i id="weatherIcon" class="' + iconClasses + '"></i></span> ' +
             '<span class="infoText"><span id="temp">' + temp + '</span>&deg;C</span> &nbsp; ' +
             '<span class="infoIcon"><i id="windDeg" class="' + windClasses + '"></i></span> ' +
             '<span class="infoText"><span id="windBft">' + windBft + '</span> Bft</span>';

  return html;
}

function showNotification(message) {
  $('#error-display').html('<p>'+message+'</p>');
  $('#error-display').show();
}

function run (loc){
  toggleWaiter(true);
  var location = loc || getDefaultLoc();

  getLiveData(location.lat, location.lon, function(err, rainData) {
    if (err) {
      showNotification(err);
      toggleWaiter(false);
      return;
    }

    getCurrentWeather(location.lat, location.lon, function(err, weatherData) {
      var weatherHTML = '';
      if (!err) {
        weatherHTML = generateWeatherHTML(weatherData);
      }

      draw(rainData, location.desc, weatherHTML);
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