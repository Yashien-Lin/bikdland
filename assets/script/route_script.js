const searchCity = document.querySelector(".js-searchCity");

var mymap = L.map("map", { zoomControl: false });
let searchType = "rent";

L.tileLayer(
  "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
  {
    attribution:
      'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxzoom: 28,
    id: "mapbox/outdoors-v11",
    tileSize: 512,
    zoomOffset: -1,
    // zoom: 18,
    accessToken:
      "pk.eyJ1IjoieWFzaGllbnh6eHoiLCJhIjoiY2t2MjkzanZmMGVmajJvbDBuNjRpZXQ2YiJ9.zqDEasaHRo5yguf6cyIytw",
  }
).addTo(mymap);

// 自己新增縮放icon到右上角
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
        console.log("longitude:", longitude);
        console.log("latitude:", latitude);

        NowPosition(longitude, latitude);
        getNowCity(longitude, latitude);
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

//Google geocoding API 取得當下所在縣市
let userCity;
function getNowCity(longitude, latitude) {
  axios
    .get(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&language=en-US&key=AIzaSyCNlSZcyD0LUbik_1bV-ubs_yvj8_eolrw`
    )
    .then((res) => {
      let data = res.data.results;
      newData = data[data.length - 3].address_components[0].long_name;
      userCity = newData.split("City")[0].replace(/\s*/g, "");

      getRouteData(userCity);
      searchCity.value = userCity;
    })
    .catch((err) => console.log(err));
}

// 當前位置的Icon樣式
var myMarker;
function NowPosition(longitude, latitude) {
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

//按下定位重新定位
const locateBtn = document.querySelector(".locate_route");
locateBtn.addEventListener("click", function (e) {
  reLocate();
});

/// 找路線頁面:
//按下選擇縣市-> 取得縣市value -> 塞到路線API
let selectedCity;
searchCity.addEventListener("change", function (e) {
  //每選一次縣市 -> 清空畫線圖層
  mymap.eachLayer(function (layer) {
    if (layer instanceof L.Path) {
      mymap.removeLayer(layer);
    }
  });

  selectedCity = e.target.value;
  getRouteData(selectedCity);
});

//取得路線資料
const searchRoute = document.querySelector(".js-searchRoute");
const routeContent = document.querySelector(".js-routeContent");
let routeData;
function getRouteData(selectedCity) {
  axios({
    method: "get",
    url: `https://ptx.transportdata.tw/MOTC/v2/Cycling/Shape/${selectedCity}?$top=30&$format=JSON`,
    headers: GetAuthorizationHeader(),
  })
    .then((res) => {
      routeData = res.data;
      console.log(routeData);

      render();
      singleRoute();
    })
    .catch((err) => {
      console.log(err);
    });
}

function render() {
  let str = "";
  let route_str = "";
  let distance;
  let roadStart;
  let roadEnd;
  let geo;

  routeData.forEach((item) => {
    //render左邊路線列表
    if (item.CyclingLength >= 1000) {
      distance = `${(item.CyclingLength /= 1000)}公里`;
    } else {
      distance = `${item.CyclingLength}公尺`;
    }

    if (item.RoadSectionStart == undefined) {
      roadStart = "暫無資料";
    } else {
      roadStart = item.RoadSectionStart;
    }

    if (item.RoadSectionEnd == undefined) {
      roadEnd = "暫無資料";
    } else {
      roadEnd = item.RoadSectionEnd;
    }

    str += `<option value="${item.RouteName}">${item.RouteName}</option>`;
    route_str += `<li class="js-perRouteInfo" data-geo="${item.Geometry}">   
    <div class="routeInfo_top">
      <h2 class="routeName">${item.RouteName}</h2>
      <div class="locationCity">
        <i class="fas fa-map-marker-alt"></i>
        <span>${item.City}</span>
      </div>
    </div>
    <div class="routeInfo_body">
      <div class="start_box">
        <div class="startIcon">起</div>
        <div class="start_routeName">${roadStart}</div>
      </div>
      <div class="end_box">
        <div class="endIcon">迄</div>
        <div class="end_routeName">${roadEnd}</div>
      </div>
    </div>
    <div class="routeInfo_bottom">
      <div class="route_distance">
        <img src="assets/image/route_grey.png" alt="" />
        <span>總長${distance}</span>
      </div>
    </div>
    <hr style="margin: 0"/>
  </li>`;

    //render畫自行車路線
    geo = item.Geometry;
    polyLine(geo);
  });
  searchRoute.innerHTML = str;
  routeContent.innerHTML = route_str;
}

//畫線
let roueteLineLayer = null;
function polyLine(geo) {
  //各縣市的每一條路線的MULTILINESTRING geo
  const wicket = new Wkt.Wkt();
  wicket.read(geo);
  const geojsonFeature = wicket.toJson();
  console.log("geojsonFeature:", geojsonFeature);

  const myStyle = {
    color: "#E75578",
    weight: 6,
    opacity: 0.65,
  };
  const roueteLineLayer = L.geoJSON(geojsonFeature, {
    style: myStyle,
    smoothFactor: 18, //調整scale
  }).addTo(mymap);

  roueteLineLayer.addData(geojsonFeature);
  // zoom the map to the layer
  mymap.fitBounds(roueteLineLayer.getBounds());
}

function singleRoute() {
  let selectedGeo;
  const allRouteInfo = routeContent.querySelectorAll(".js-perRouteInfo");

  allRouteInfo.forEach((perRoute) => {
    perRoute.addEventListener("click", function (e) {
      selectedGeo = perRoute.dataset.geo;

      //每選一次路線 -> 清空畫線圖層
      mymap.eachLayer(function (layer) {
        if (layer instanceof L.Path) {
          mymap.removeLayer(layer);
        }
      });

      console.log(selectedGeo);
      polyLine(selectedGeo);
    });
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
