_html2canvas.Renderer.Canvas = function(options) {
  options = options || {};

  var doc = document,
  safeImages = [],
  testCanvas = document.createElement("canvas"),
  testctx = testCanvas.getContext("2d"),
  Util = _html2canvas.Util,
  canvas = options.canvas || doc.createElement('canvas');

  function createShape(ctx, args) {
    ctx.beginPath();
    args.forEach(function(arg) {
      ctx[arg.name].apply(ctx, arg['arguments']);
    });
    ctx.closePath();
  }

  function safeImage(item) {
    if (safeImages.indexOf(item['arguments'][0].src ) === -1) {
      testctx.drawImage(item['arguments'][0], 0, 0);
      try {
        testctx.getImageData(0, 0, 1, 1);
      } catch(e) {
        testCanvas = doc.createElement("canvas");
        testctx = testCanvas.getContext("2d");
        return false;
      }
      safeImages.push(item['arguments'][0].src);
    }
    return true;
  }

  function renderItem(ctx, item) {
    switch(item.type){
      case "variable":
        ctx[item.name] = item['arguments'];
        break;
      case "function":
        switch(item.name) {
          case "createPattern":
            if (item['arguments'][0].width > 0 && item['arguments'][0].height > 0) {
              try {
                ctx.fillStyle = ctx.createPattern(item['arguments'][0], "repeat");
              }
              catch(e) {
                Util.log("html2canvas: Renderer: Error creating pattern", e.message);
              }
            }
            break;
          case "drawShape":
            createShape(ctx, item['arguments']);
            break;
          case "drawImage":
            if (item['arguments'][8] > 0 && item['arguments'][7] > 0) {
              if (!options.taintTest || (options.taintTest && safeImage(item))) {
                ctx.drawImage.apply( ctx, item['arguments'] );
              }
            }
            break;
          default:
            ctx[item.name].apply(ctx, item['arguments']);
        }
        break;
    }
  }

  function getBrowserInfo() {
    var ua= navigator.userAgent, tem,
    M= ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
    if(/trident/i.test(M[1])){
        tem=  /\brv[ :]+(\d+)/g.exec(ua) || [];
        return ['IE', (tem[1] || '')];
    }
    if(M[1]=== 'Chrome'){
        tem= ua.match(/\b(OPR|Edge?)\/(\d+)/);
        if(tem!= null) {
          var stem = tem.slice(1);
          stem[0].replace('OPR', 'Opera').replace('Edg ', 'Edge ');
          return stem;
        }
    }
    M= M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
    if((tem= ua.match(/version\/(\d+)/i))!= null) M.splice(1, 1, tem[1]);
    return M;
  }

  function getBrowserCanvasLimit(scale) {
    var browser = getBrowserInfo()[0];
    var scaleLimit = function(val) { return Math.floor(val / scale) };
    var restrictions = {
      DEFAULT: { width: scaleLimit(8192), height: scaleLimit(8192) },
      Edge: { width: scaleLimit(8192), height: scaleLimit(8192) },
      Firefox: { width: scaleLimit(32767), height: scaleLimit(32767) },
      Safari: { width: scaleLimit(32767), height: scaleLimit(32767) },
      Chrome: { width: scaleLimit(32767), height: scaleLimit(32767) }
    }

    return [restrictions[browser] || restrictions['DEFAULT'], browser]
  }

  return function(parsedData, options, document, queue, _html2canvas) {
    var ctx = canvas.getContext("2d"),
      newCanvas,
      bounds,
      boundScaleKeys,
      fstyle,
      zStack = parsedData.stack;

    if (options.dpi) {
      options.scale = options.dpi / 96;
    }

    var browserCanvasLimit = getBrowserCanvasLimit(options.scale);
    var canvasLimit = browserCanvasLimit[0];

    canvas.width = canvas.style.width = Math.min((options.width || zStack.ctx.width) * options.scale, canvasLimit.width);
    canvas.height = canvas.style.height = Math.min((options.height || zStack.ctx.height) * options.scale, canvasLimit.height);

    fstyle = ctx.fillStyle;
    ctx.scale(options.scale, options.scale);
    ctx.fillStyle = (Util.isTransparent(zStack.backgroundColor) && options.background !== undefined) ? options.background : parsedData.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = fstyle;

    queue.forEach(function(storageContext) {
      // set common settings for canvas
      ctx.textBaseline = "bottom";
      ctx.save();

      if (storageContext.transform.matrix) {
        ctx.translate(storageContext.transform.origin[0], storageContext.transform.origin[1]);
        ctx.transform.apply(ctx, storageContext.transform.matrix);
        ctx.translate(-storageContext.transform.origin[0], -storageContext.transform.origin[1]);
      }

      if (storageContext.clip){
        ctx.beginPath();
        ctx.rect(storageContext.clip.left, storageContext.clip.top, storageContext.clip.width, storageContext.clip.height);
        ctx.clip();
      }

      if (storageContext.ctx.storage) {
        storageContext.ctx.storage.forEach(function(item) {
          renderItem(ctx, item);
        });
      }

      ctx.restore();
    });

    Util.log("html2canvas: Renderer: Canvas renderer done, scaled at " + options.scale + " - returning canvas obj");

    if (options.elements.length === 1) {
      if (typeof options.elements[0] === "object" && options.elements[0].nodeName !== "BODY") {
        // crop image to the bounds of selected (single) element
        bounds = _html2canvas.Util.Bounds(options.elements[0]);
        boundScaleKeys = ['width', 'height', 'top', 'left'];

        boundScaleKeys.forEach(function(key) {
          bounds[key] = bounds[key] * options.scale;
        });

        newCanvas = document.createElement('canvas');
        newCanvas.width = Math.ceil(bounds.width);
        newCanvas.height = Math.ceil(bounds.height);
        newCanvas.style.width = newCanvas.width + 'px';
        newCanvas.style.height = newCanvas.height + 'px';

        ctx = newCanvas.getContext("2d");
        ctx.drawImage(canvas, bounds.left, bounds.top, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
        canvas = null;
        return newCanvas;
      }
    }

    return canvas;
  };
};