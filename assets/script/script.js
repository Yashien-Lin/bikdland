var mymap = L.map("map", { zoomControl: false });
let searchType = "rent";

L.tileLayer(
  "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
  {
    attribution:
      'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxzoom: 18,
    id: "mapbox/outdoors-v11",
    tileSize: 512,
    zoomOffset: -1,
    zoom: 18,
    accessToken:
      "pk.eyJ1IjoieWFzaGllbnh6eHoiLCJhIjoiY2t2MjkzanZmMGVmajJvbDBuNjRpZXQ2YiJ9.zqDEasaHRo5yguf6cyIytw",
  }
).addTo(mymap);

// 新增縮放icon到右上角
L.control.zoom({ position: "topright" }).addTo(mymap);

// navigator web api 獲取當下經緯度
let latitude;
let longitude;
function reLocate() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (position) {
        longitude = position.coords.longitude;
        latitude = position.coords.latitude;

        // 初始 view 的位置
        mymap.setView([latitude, longitude], 15);

        getStationData(longitude, latitude);
        NowPosition(longitude, latitude);
      },
      function (e) {
        const msg = e.code;
        const dd = e.message;
        console.error(msg);
        console.error(dd);
      }
    );
  }
}
reLocate();

// 拿到的經緯度 -> 塞到url參數 -> 串接租借站資料
let stationData = [];
function getStationData(longitude, latitude) {
  let url = `https://ptx.transportdata.tw/MOTC/v2/Bike/Station/NearBy?$top=30&$spatialFilter=nearby(${latitude},${longitude},1000)&$format=JSON`;

  axios({
    method: "get",
    url: url,
    headers: GetAuthorizationHeader(),
  })
    .then(function (res) {
      stationData = res.data;
      getStationStatus(longitude, latitude);
    })
    .catch(function (err) {
      console.log(err);
    });
}

// 串接即時車位資料
let newData;
let rentalData = [];
let sortType;
let cacheData;
function getStationStatus(longitude, latitude) {
  let url = `https://ptx.transportdata.tw/MOTC/v2/Bike/Availability/NearBy?$top=30&$spatialFilter=nearby(${latitude},${longitude},1000)&$format=JSON`;
  axios({ method: "get", url: url, headers: GetAuthorizationHeader() })
    .then(function (res) {
      rentalData = res.data;

      newData = [];
      stationData.forEach(function (x) {
        rentalData.forEach(function (y) {
          if (x.StationUID == y.StationUID) {
            let obj = {};
            obj.StationName = x.StationName.Zh_tw;
            obj.AvailableRentBikes = y.AvailableRentBikes;
            obj.AvailableReturnBikes = y.AvailableReturnBikes;
            obj.PositionLat = x.StationPosition.PositionLat;
            obj.PositionLon = x.StationPosition.PositionLon;
            distance = distanceCount(
              latitude,
              longitude,
              x.StationPosition.PositionLat,
              x.StationPosition.PositionLon
            );

            obj.distance = distance;
            newData.push(obj);
          }
        });
      });

      //預設排序: 小=>大
      newData.sort(function (a, b) {
        return parseInt(a.distance) - parseInt(b.distance);
      });

      cacheData = newData;
      render();
    })
    .catch(function (err) {
      console.log("getStationStatus err:", err);
    });
}

// API 驗證用
function GetAuthorizationHeader() {
  var AppID = "106dd91d71204e77ad5b3be1ea162e7c";
  var AppKey = "C0XualwSfBvKfjS_RDRcnDoSc6A";

  let GMTString = new Date().toGMTString();
  let ShaObj = new jsSHA("SHA-1", "TEXT");
  ShaObj.setHMACKey(AppKey, "TEXT");
  ShaObj.update("x-date: " + GMTString);
  let HMAC = ShaObj.getHMAC("B64");
  let Authorization =
    'hmac username="' +
    AppID +
    '", algorithm="hmac-sha1", headers="x-date", signature="' +
    HMAC +
    '"';
  return { Authorization: Authorization, "X-Date": GMTString };
}

//資料渲染
const stationContent = document.querySelector(".stationContent");
let rentBikesQty;
let returnBikesQty;
let stationLat;
let stationLon;

function render() {
  var markersLayer = new L.MarkerClusterGroup().addTo(mymap);
  markersLayer.clearLayers();

  let str = "";
  cacheData.forEach(function (item) {
    rentBikesQty = item.AvailableRentBikes;
    returnBikesQty = item.AvailableReturnBikes;
    stationLat = item.PositionLat;
    stationLon = item.PositionLon;
    distance = item.distance;

    str += `<li class="perStationInfo js-perStationInfo" data-geo="${item.PositionLat},${item.PositionLon}">
    <h2 class="stationName">${item.StationName}</h2>
    <div class="rental_status">
      <div class="bikeQty_Box">
        <div>
          <i class="fas fa-bicycle"></i>
          <span>可租借</span>
        </div>
        <div class="bikeQty">${item.AvailableRentBikes}</div>
      </div>
      <div class="parkingQty_Box">
        <div class="parking_title">
          <img src="assets/image/park_Default.svg" alt="" />
          <span>可停車</span>
        </div>
        <div class="parkingQty">${item.AvailableReturnBikes}</div>
      </div>
    </div>
    <div class="StationInfo_bottom">
      <div class="rentReturn_status">可借可還</div>
      <div class="distance">
        <i class="fas fa-map-marker-alt"></i>
        <span>距離${distance}公尺</span>
      </div>
    </div>
    <hr style="margin:0"/>
    </li>`;

    rendorMarkers(
      item.PositionLat,
      item.PositionLon,
      item.StationName,
      item.AvailableRentBikes,
      item.AvailableReturnBikes,
      distance,
      searchType,
      markersLayer
    );
  });

  stationContent.innerHTML = str;
  statusChange();
  bindStationInfo();
}

//租借字樣&顏色變更
function statusChange() {
  const bikeQtyBox = document.querySelectorAll(".bikeQty_Box");
  const parkingQtyBox = document.querySelectorAll(".parkingQty_Box");
  const perStationInfo = document.querySelectorAll(".js-perStationInfo");

  //可借車區塊
  bikeQtyBox.forEach((item) => {
    const bikeQty = item.querySelector(".bikeQty");

    if (bikeQty.textContent == 0) {
      item.classList.add("disable_color");
    } else if (bikeQty.textContent <= 5) {
      item.classList.add("limited_color");
    }
  });

  //可還車區塊
  parkingQtyBox.forEach((item) => {
    const parkingQty = item.querySelector(".parkingQty");
    const parkingIcon = item.querySelector("img");
    if (parkingQty.textContent == 0) {
      item.classList.add("disable_color");
      parkingIcon.src = "assets/image/park_Disabled.svg";
    } else if (parkingQty.textContent <= 5) {
      item.classList.add("limited_color");
      parkingIcon.src = "assets/image/park_Limited_dark.svg";
    }
  });

  //可借可還字樣
  let count = 0;
  perStationInfo.forEach((item) => {
    const bikeQty = item.querySelector(".bikeQty");
    const parkingQty = item.querySelector(".parkingQty");
    const rentReturnStatus = item.querySelector(".rentReturn_status");

    if (bikeQty.textContent == 0 && parkingQty.textContent == 0) {
      rentReturnStatus.textContent = "站點施工中";
      rentReturnStatus.classList.add("noRentAndReturn_color");
    } else if (bikeQty.textContent == 0 && parkingQty.textContent > 0) {
      rentReturnStatus.textContent = "只可停車";
      rentReturnStatus.classList.add("onlyRentOrReturn_color");
    } else if (bikeQty.textContent > 0 && parkingQty.textContent == 0) {
      rentReturnStatus.textContent = "只可借車";
      rentReturnStatus.classList.add("onlyRentOrReturn_color");
    } else {
      rentReturnStatus.textContent = "可借可還";
    }
    count += 1;
  });
}

function bindStationInfo() {
  const perStationInfo = document.querySelectorAll(".js-perStationInfo");
  let pos;
  perStationInfo.forEach((item) => {
    item.addEventListener("click", function () {
      pos = item.dataset.geo.split(","); ///到這裡(轉為經緯度)
      mymap.setView(pos, 20);
    });
  });
}

//計算距離
function distanceCount(lat1, lon1, lat2, lon2) {
  var R = 6371; // km (change this constant to get miles)
  var dLat = ((lat2 - lat1) * Math.PI) / 180;
  var dLon = ((lon2 - lon1) * Math.PI) / 180;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;
  if (d > 1) return Math.round(d) + "km";
  else if (d <= 1) return Math.round(d * 1000) + "m";
  return d;
}

//按下定位重新定位
const locateBtn = document.querySelector(".locate");
locateBtn.addEventListener("click", function (e) {
  // 重新設定 view 的位置
  mymap.setView([latitude, longitude], 18);
});

var myMarker;
function NowPosition(longitude, latitude) {
  //myMarker若有資料，就remove，否則會一直疊上去
  if (myMarker) {
    mymap.removeLayer(myMarker);
  }

  // 當前位置的Icon樣式
  var IamHere = L.icon({
    iconUrl: "assets/image/here.svg",
    iconSize: [65, 65],
    // iconAnchor: [22, 94],
    popupAnchor: [-3, -30],
    shadowSize: [68, 95],
    shadowAnchor: [22, 94],
  });

  // 標記當前位置Icon;
  myMarker = L.marker([latitude, longitude], {
    icon: IamHere,
  })
    .addTo(mymap)
    .bindPopup("<div class='popUp'>You're here!</div>")
    .openPopup();
}

function rendorMarkers(
  lat,
  lon,
  stationName,
  availableRentBikes,
  availableReturnBikes,
  distance,
  searchType,
  markersLayer
) {
  // 新增一個空的圖層放markers
  var markersLayer = new L.MarkerClusterGroup().addTo(mymap);
  markersLayer.clearLayers();

  //單車&車位的Icon樣式
  let markerNum;
  let markerColor = "Default";
  let numColor;
  let rentColor;
  let returnColor;
  let iconColor;
  if (searchType == "rent") {
    markerNum = availableRentBikes;
    if (availableRentBikes == 0) {
      markerColor = "Disabled";
      numColor = "colorDisabled";
    } else if (availableRentBikes <= 5) {
      markerColor = "Limited";
      numColor = "colorLimited";
      labelColor = "labelColorLimited";
    }
  } else {
    markerNum = availableReturnBikes;
    if (availableReturnBikes == 0) {
      markerColor = "Disabled";
      numColor = "colorDisabled";
      labelColor = "labelColorDisabled";
    } else if (availableReturnBikes <= 5) {
      markerColor = "Limited";
      numColor = "colorLimited";
      labelColor = "labelColorLimited";
    }
  }

  var bikeLocateIcon = L.divIcon({
    html: `<div><img src="assets/image/bike_State${markerColor}.svg"><span class='bikeIconNum ${numColor}'>${markerNum}</span></div>`,
    iconSize: [65, 65],
    className: "bikeLocateIcon",
    iconAnchor: [16, 75],
    popupAnchor: [15, -80],
    // shadowSize: [68, 95],
    // shadowAnchor: [22, 94],
  });

  // 標記單車&車位Icon
  if (availableRentBikes == 0) {
    rentColor = "labelColorDisabled";
    iconColor = "Disabled";
  } else if (availableRentBikes <= 5) {
    rentColor = "labelColorLimited";
    iconColor = "Limited";
  } else {
    iconColor = "Default";
  }

  if (availableReturnBikes == 0) {
    returnColor = "labelColorDisabled";
    iconColor = "Disabled";
  } else if (availableReturnBikes <= 5) {
    returnColor = "labelColorLimited";
    iconColor = "Limited";
  } else {
    iconColor = "Default";
  }

  markersLayer.addLayer(
    L.marker([lat, lon], {
      icon: bikeLocateIcon,
    }).bindPopup(
      `<div class='markerInfoDetail'>
        <p class='markInfoTitle'>${stationName}<br></p>
        <div class='markInfoBody'>
          <div class='numInfos'>
            <div class='numLabel ${rentColor}'>
              <i class="fas fa-bicycle"></i>
              <span>${availableRentBikes}</span>
            </div>
            <div class='numLabel ${returnColor}'>
              <img src="assets/image/park_${iconColor}.svg"/>
              <span>${availableReturnBikes}</span>
            </div>
          </div>
          <div class='distanceInfo'>
            <i class="fas fa-map-marker-alt"></i>
            <span>距離${distance}公尺</span>  
          </div>
        </div>
      </div>`
    )
  );

  mymap.addLayer(markersLayer);
}

const searchBox = document.querySelector(".js-searchBox");
searchBox.addEventListener("change", function (e) {
  const reg = new RegExp(e.target.value, "gi");
  cacheData = newData.filter((item) => item.StationName.match(reg));
  render();
});

//車站排序
const sortingBtn = document.querySelector(".sorting_btn");
const sortingList = document.querySelector(".sorting_list");

//排序類別列表 收合
sortingBtn.addEventListener("click", function () {
  sortingList.classList.toggle("showUp");
});

//選擇類別-> 排序
sortingList.addEventListener("click", function (e) {
  sortType = e.target.dataset.sort;
  sortingList.classList.toggle("showUp");

  if (sortType == "returnNum") {
    cacheData.sort(function (a, b) {
      return (
        parseInt(b.AvailableReturnBikes) - parseInt(a.AvailableReturnBikes)
      );
    });
  } else if (sortType == "rentNum") {
    cacheData.sort(function (a, b) {
      return parseInt(b.AvailableRentBikes) - parseInt(a.AvailableRentBikes);
    });
  } else {
    cacheData.sort(function (a, b) {
      return parseInt(a.distance) - parseInt(b.distance);
    });
  }

  render();
});

//找單車&找車位切換
const find_bike_btn = document.querySelector(".find_bike");
const find_parking_btn = document.querySelector(".find_parking");

find_parking_btn.addEventListener("click", function (e) {
  find_parking_btn.firstElementChild.setAttribute(
    "src",
    "assets/image/parking_white.png"
  );
  find_parking_btn.classList.add("active");
  find_bike_btn.classList.remove("active");
  let node = e.target;
  while (!node.dataset.status) {
    node = node.parentNode;
  }

  searchType = node.dataset.status;
  render();
});

find_bike_btn.addEventListener("click", function (e) {
  find_parking_btn.firstElementChild.setAttribute(
    "src",
    "assets/image/park_Default.svg"
  );
  find_bike_btn.classList.add("active");
  find_parking_btn.classList.remove("active");
  let node = e.target;
  while (!node.dataset.status) {
    node = node.parentNode;
  }
  searchType = node.dataset.status;
  render();
});
