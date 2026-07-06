$(function () {
  $('a[href^="#"]').click(function () {
    var speed = 600;
    var href = $(this).attr("href");
    var target = $(href == "#" || href == "" ? 'html' : href);
    if (href == "#d1") {
      var position = 0;
    }
    if (href == "#d2") {
      var position = 250;
    }
    if (href == "#d3") {
      var position = 500;
    }
    //console.log(href);
    var x = document.getElementsByClassName('slider-x');
    x[0].style.scrollSnapType = "none";
    $('.slider-x').css('scroll-snap-points-x', 'none');
    $('.slider-x').animate({ scrollLeft: position }, speed, 'swing');
    setTimeout(function () {
      x[0].style.scrollSnapType = "x mandatory";
    }, 500);
    //$('.slider-x').css('scroll-snap-points-x','x mandatory');
    return false;
  });

  $('.slider-x').scroll(function () {
    var x = document.getElementsByClassName('slider-x');
    var d1 = document.getElementById('d1');
    var d2 = document.getElementById('d2');
    var d3 = document.getElementById('d3');
    var b = document.getElementsByClassName('select_button');
    var localload = document.getElementById('loadstart');

    if (x[0].scrollLeft <= 250) {
      var d1s = 1.0 + 0.14 * (1 - (x[0].scrollLeft / 250));
      d1.style.transform = "scale(" + d1s + ")";
      var d2s = 1.0 + 0.14 * (x[0].scrollLeft / 250);
      d2.style.transform = "scale(" + d2s + ")";
      d3.style.transform = "scale(1.0)";
    }
    else if (x[0].scrollLeft <= 500) {
      d1.style.transform = "scale(1.0)";
      var d2s = 1.0 + 0.14 * (1 - ((x[0].scrollLeft - 250) / 250));
      d2.style.transform = "scale(" + d2s + ")";
      var d3s = 1.0 + 0.14 * ((x[0].scrollLeft - 250) / 250);
      d3.style.transform = "scale(" + d3s + ")";
    }
    else {
      d1.style.transform = "scale(1.0)";
      d2.style.transform = "scale(1.0)";
      d3.style.transform = "scale(1.0)";
    }

    if (x[0].scrollLeft >= 0 && x[0].scrollLeft <= 10) {
      b[0].style.opacity = "1.0";
      localload.style.opacity = "1.0";

      b[0].style.display = "block";
      localload.style.display = "none";
    }
    else if (x[0].scrollLeft >= 240 && x[0].scrollLeft <= 260) {
      b[0].style.opacity = "1.0";
      localload.style.opacity = "1.0";

      b[0].style.display = "none";
      localload.style.display = "block";
    }
    else if (x[0].scrollLeft >= 490 && x[0].scrollLeft <= 510) {
      b[0].style.opacity = "1.0";
      localload.style.opacity = "1.0";

      b[0].style.display = "block";
      localload.style.display = "none";
    }
    else {
      b[0].style.opacity = "0.5";
      localload.style.opacity = "0.5";
    }

  });

  $('.select_button').click(function () {
    var x = document.getElementsByClassName('slider-x');
    if (x[0].scrollLeft == 0) {
      window.location.href = window.PROGRAMMING_PATH;
    }
    else if (x[0].scrollLeft == 250) {
      //window.location.href = window.PROGRAMMING_PATH;
    }
    else if (x[0].scrollLeft == 500) {
      window.location.href = window.PROGRAMMING_PATH + '?loaddata=LastRun';
    }
    else {

    }
  });


  function readSingleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    // XMLファイルとして読み込む場合
    if (fileName.endsWith(".xml")) {
      reader.onload = function (e) {
        const xmlText = e.target.result.toString();
        let xmlDom;

        try {
          localStorage.setItem("Local", xmlText);
        } catch (err) {
          console.error(err);
          alert("XMLファイルの読み込みに失敗しました");
          localStorage.removeItem("Local");
        }

        if (xmlDom) {
          Code.workspace.clear();
          Blockly.Xml.domToWorkspace(xmlDom, Code.workspace);
        }
      };
      reader.readAsText(file);
    }

    // ── 非圧縮JSONファイルの処理 ──
    else if (fileName.endsWith(".json")) {
      reader.onload = function (e) {
        try {
          const jsonText = e.target.result.toString();
          localStorage.setItem("Local", jsonText);
        } catch (err) {
          console.error(err);
          alert("JSONファイルの読み込みまたは解析に失敗しました");
          localStorage.removeItem("Local");
        }
      };
      reader.readAsText(file);
    }

    // ZIP圧縮JSONとして読み込む場合（.blch や .zip）
    else {
      reader.onload = function (e) {
        try {
          const arrayBuffer = e.target.result;
          const uint8 = new Uint8Array(arrayBuffer);
          const unzipped = fflate.unzipSync(uint8);

          if (!unzipped["program.json"]) {
            alert("program.json が ZIP 内に見つかりませんでした");
            localStorage.removeItem("Local");
          }

          const jsonText = new TextDecoder("utf-8").decode(unzipped["program.json"]);
          localStorage.setItem("Local", jsonText);
        } catch (err) {
          console.error(err);
          alert("ZIPファイルの展開または読み込みに失敗しました");
          localStorage.removeItem("Local");
        }
      };
      reader.readAsArrayBuffer(file);
    }
    window.location.href = window.PROGRAMMING_PATH + '?loaddata=Local';
  }

  document.getElementById('file_load').addEventListener('change', readSingleFile, false);
});
