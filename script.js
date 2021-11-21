var mymap = L.map("map", { zoomControl: false }).setView([51.505, -0.09], 13);

L.tileLayer(
  "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
  {
    attribution:
      'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxzoom: 30,
    id: "mapbox/streets-v11",
    tileSize: 512,
    zoomOffset: -1,
    zoom: 28,
    accessToken:
      "pk.eyJ1IjoieWFzaGllbnh6eHoiLCJhIjoiY2t2MjlpMzBxMDFkdjJzbDdxbm8yYmM5byJ9.fN2QIK9fAfUXmdNZdv_oGA",
  }
).addTo(mymap);

// 自己新增縮放icon到右上角
L.control.zoom({ position: "topright" }).addTo(mymap);

// 使用 navigator web api 獲取當下位置(經緯度)
function reLocate() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (position) {
        const longitude = position.coords.longitude; // 經度
        const latitude = position.coords.latitude; // 緯度
        console.log("longitude:", longitude);
        console.log("latitude:", latitude);

        // 重新設定 view 的位置
        mymap.setView([latitude, longitude], 18);
        // 將經緯度當作參數傳給 getData 執行
        getStationData(longitude, latitude);
      },
      // 錯誤訊息
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
      // console.log("stationData:", stationData); //[{},{}..數個租借站資料]
      render();
      getStationStatus(longitude, latitude);
      // return stationData;
      console.log("stationData:", stationData);
    })
    .catch(function (err) {
      console.log(err);
    });
}

// 串接即時車位資料
let newData = [];
let rentalData = [];
function getStationStatus(longitude, latitude) {
  let url = `https://ptx.transportdata.tw/MOTC/v2/Bike/Availability/NearBy?$top=30&$spatialFilter=nearby(${latitude},${longitude},1000)&$format=JSON`;
  axios({ method: "get", url: url, headers: GetAuthorizationHeader() })
    .then(function (res) {
      rentalData = res.data;
      console.log("rentalData:", rentalData); //[{},{}..數個即時車位資料]

      // 試試forEach方式:
      // stationData.forEach(function (item) {
      //   if (item.StationUID == "NWT1125") {
      //     console.log(item.StationName);
      //   }
      // });

      stationData.forEach(function (x) {
        rentalData.forEach(function (y) {
          if (x.StationUID == y.StationUID) {
            // console.log([y.AvailableRentBikes, y.AvailableReturnBikes]);
            let obj = {};
            obj.StationName = x.StationName.Zh_tw;
            obj.AvailableRentBikes = y.AvailableRentBikes;
            obj.AvailableReturnBikes = y.AvailableReturnBikes;
            obj.PositionLat = x.StationPosition.PositionLat;
            obj.PositionLon = x.StationPosition.PositionLon;
            newData.push(obj);
          }
        });
      });
      // console.log("newData:", newData); //[{AvailableRentBikes: 22, AvailableReturnBikes: 51, StationName: "YouBike1.0_捷運南勢角站(4號出口)"}]
      render(longitude, latitude);
      // colorChange(longitude, latitude);
      // rendorMarkers(newData);
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
let str = "";
let rentBikesQty;
let returnBikesQty;
let stationLat;
let stationLon;

function render(longitude, latitude) {
  newData.forEach(function (item) {
    rentBikesQty = item.AvailableRentBikes;
    returnBikesQty = item.AvailableReturnBikes;
    stationLat = item.PositionLat;
    stationLon = item.PositionLon;
    distance = distanceCount(stationLat, stationLon, latitude, longitude);

    str += `<li class="perStationInfo">
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
          <img src="image/parking.png" alt="" />
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
    <hr />
    </li>`;

    // const bikeQtyBox = document.querySelector(".bikeQty_Box");
    // const parkingQtyBox = document.querySelector(".parkingQty_Box");
    // if (rentBikesQty <= 5 || returnBikesQty <= 5) {
    //   console.log(bikeQtyBox.innerHTML);
    // }
    // colorChange(rentBikesQty, returnBikesQty);
  });
  // console.log(str);
  stationContent.innerHTML = str;
  colorChange();
}

//租借數量區塊變色
function colorChange() {
  const bikeQtyBox = document.querySelectorAll(".bikeQty_Box");
  const parkingQtyBox = document.querySelectorAll(".parkingQty_Box");
  // const rentalStatus = document.querySelectorAll(".rental_status");
  const perStationInfo = document.querySelectorAll(".perStationInfo");

  //可借車區塊
  bikeQtyBox.forEach((item) => {
    const bikeQty = item.querySelector(".bikeQty");
    // console.log(bikeQty)
    if (bikeQty.textContent == 0) {
      item.classList.add("disable_color");
      // console.log("item:", item);
    } else if (bikeQty.textContent <= 5) {
      // console.log("item:", item);
      item.classList.add("limited_color");
    }
  });

  //可還車區塊
  parkingQtyBox.forEach((item) => {
    const parkingQty = item.querySelector(".parkingQty");
    const parkingIcon = item.querySelector("img");
    // console.log(parkingQty_Box)
    if (parkingQty.textContent == 0) {
      item.classList.add("disable_color");
      parkingIcon.src = "image/p_grey.svg";

      // console.log("item:", item);
    } else if (parkingQty.textContent <= 5) {
      // console.log("item:", item);
      item.classList.add("limited_color");
      parkingIcon.src = "image/p_pink.svg";
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
    // console.log(str);
    // console.log("bikeQty:", bikeQty, "parkingQty:", parkingQty);
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
  // console.log("d:", d);
}

//按下定位重新定位
const locateBtn = document.querySelector(".locate");

locateBtn.addEventListener("click", function (e) {
  reLocate();
});

// 當前位置的Icon樣式
var IamHere = L.icon({
  iconUrl: "image/here.svg",
  iconSize: [65, 65],
  // iconAnchor: [22, 94],
  popupAnchor: [-3, -30],
  shadowSize: [68, 95],
  shadowAnchor: [22, 94],
});

//單車&車位的Icon樣式
var bikeLocateIcon = L.divIcon({
  html: '<i class="fas fa-map-marker-alt fa-4x"></i>',
  iconSize: [65, 65],
  className: "bikeLocateIcon",
  // iconAnchor: [22, 94],
  popupAnchor: [-10, -30],
  // shadowSize: [68, 95],
  // shadowAnchor: [22, 94],
});

// 標記當前位置Icon;
// var marker = L.marker([24.9925386, 121.4998838], { icon: IamHere })
//   .addTo(mymap)
//   .bindPopup("<div class='popUp'>I'm here!</div>")
//   .openPopup();

// // 標記單車&車位Icon
// var marker = L.marker([24.992341940629295, 121.49975990873575], {
//   icon: bikeLocateIcon,
// })
//   .addTo(mymap)
//   .bindPopup("<div class='popUp'>Bike is here!</div>");

var markers = new L.MarkerClusterGroup().addTo(mymap);
var newNewData = [
  { name: "軟體園區", lat: 24.992341940629295, lng: 121.49975990873575 },
  { name: "ikea", lat: 24.99304580593615, lng: 121.50010592072255 },
];

newNewData.forEach((item) => {
  markers.addLayer(
    L.marker([item.lat, item.lng], {
      icon: bikeLocateIcon,
    })
  );
  // console.log(item.lat, item.lng);
  mymap.addLayer(markers);
});
// .bindPopup(`${item.StationName}`);
// console.log("newData:", newData);

// rendorMarkers(newData);
// 景點detail下拉區塊
// let closeBtn = document.querySelector(".desc-closeBtn");
// let describeLayer = document.querySelector(".describe-layer");
// let descLayerInfo = document.querySelector(".descLayer-Info");
// let descLayerImage = document.querySelector(".descLayer-Image");

// let closeBefore = window.getComputedStyle(closeBtn, "::before");

// closeBtn.addEventListener("click", function () {
//   describeLayer.classList.toggle("toggle");
//   descLayerInfo.classList.toggle("toggle");
// });

// $(document).ready(function () {
//   $(".desc-closeBtn").click(function () {
//     $(".describe-layer").slideToggle("500");
//     $(".desc-closeBtn").css("bottom", "0");
//   });
// });
