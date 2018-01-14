/**
 *  ______  __      ______  __    __  ______  ______  ______  __  __   __  ______  __  __  __  __  _____
 * /\  __ \/\ \    /\  ___\/\ "-./  \/\  __ \/\  == \/\__  _\/\ \/\ "-.\ \/\  == \/\ \/\ \/\ \/\ \/\  __-.
 * \ \ \/\ \ \ \___\ \  __\\ \ \-./\ \ \  __ \ \  __<\/_/\ \/\ \ \ \ \-.  \ \  __<\ \ \_\ \ \ \_\ \ \ \/\ \
 *  \ \_____\ \_____\ \_____\ \_\ \ \_\ \_\ \_\ \_\ \_\ \ \_\ \ \_\ \_\\"\_\ \_\ \_\ \_____\ \_____\ \____-
 *   \/_____/\/_____/\/_____/\/_/  \/_/\/_/\/_/\/_/ /_/  \/_/  \/_/\/_/ \/_/\/_/ /_/\/_____/\/_____/\/____/
 *
 */

/**
 * Funksjon som utvider en prototype og hvis det allerede finnes en verdi i prototypen så lages det en ny funksjon slik at begge funksjonene kalles
 * @param {Array} sources - Prototype av objektet som er kilden
 */
Object.prototype.extend = function (sources) {
  if (Array.isArray(sources)) {
    for (var i = sources.length - 1; i >= 0; i--) {
      this.extend(sources[i])
    }
  } else {
    for (var k in sources) {
      if (sources.hasOwnProperty(k)) {
        var res = sources[k]
        if (this[k]) {
          res = (function (id) {
            var old = sources[id],
              neew = this[id]
            return function () {
              old.apply(this, arguments)
              return neew.apply(this, arguments)
            }
          }.call(this, k))
        }
        this[k] = res
      }
    }
  }
}

/**
 * Hjelpeobjekt med nyttige funksjoner
 * @type {Object}
 */
var calc = {
  clock: {
    secondsToMMSS: function (secs) {
      var res = '',
        mins = secs / 60
      secs = (mins - Math.floor(mins)) * 60

      if (mins < 10) res += '0' + Math.floor(mins).toString()
      else res += Math.floor(mins).toString()
      res += ':'
      if (secs < 10) res += '0' + Math.floor(secs).toString()
      else res += Math.floor(secs).toString()
      return res
    }
  },
  geometry: {
    /**
         * Tar først inn cordinatene til 2 punkter og så inn en x-verdi som man ønsker å finne y verdien til
         * @param {Number} ax - Første punkt x-verdi
         * @param {Number} ay - Første punkt y-verdi
         * @param {Number} bx - Andre punkt x-verdi
         * @param {Number} by - Andre punkt y-verdi
         * @param {Number} x - Verdien man ønsker å finne y verdien til
         * @returns {Number} y-verdien av x-verdien man ville finne
         */
    interpolation: function (ax, ay, bx, by, x) {
      return (((x - ax) * (by - ay)) / (bx - ax)) + ay
    },
    distance: function (pt1, pt2) {
      return Math.sqrt((pt1.x - pt2.x) * (pt1.x - pt2.x) + (pt1.y - pt2.y) * (pt1.y - pt2.y))
    },
    median: function (pt1, pt2) {
      return { x: (pt1.x + pt2.x) / 2, y: (pt1.y + pt2.y) / 2 }
    },
    gradient: function (pt1, pt2) {
      return (pt2.y - pt1.y) / (pt2.x - pt1.x)
    },
    point: {
      draw: function (pt, ctx, size, color) {
        var s = size || 4
        ctx.save()
        ctx.strokeStyle = color || 'white'
        ctx.translate(pt.x, pt.y)
        ctx.beginPath()
        ctx.moveTo(-s, -s)
        ctx.lineTo(s, s)
        ctx.moveTo(-s, s)
        ctx.lineTo(s, -s)
        ctx.stroke()
        ctx.restore()
      }
    }
  },
  color: {
    random: function () {
      var rand_hex = '#' + ((1 - Math.random()) * 0xFFFFFF << 0).toString(16)
      return (calc.color.validHEX(rand_hex) ? rand_hex : calc.color.random())
    },
    validHEX: function (hex) {
      return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(hex)
    }
  },
  input: {
    mouse: {
      getPos: function (e, canvas) {
        var rect = canvas.getBoundingClientRect()
        return {
          x: (e.clientX - rect.left) / (rect.right - rect.left) * canvas.width,
          y: (e.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height
        }
      }
    },
    file: {
      json: function (file, callback) {
        var rawFile = new XMLHttpRequest()
        rawFile.overrideMimeType('application/json')
        rawFile.open('GET', file, true)
        rawFile.onreadystatechange = function () {
          if (rawFile.readyState === 4 && rawFile.status == '200') {
            callback(rawFile.responseText)
          }
        }
        rawFile.send(null)
      }
    }
  }
}

/**
 * Forteller om man debugger eller ikke, er nyttig for hjelpelinjer under debugging
 * @type {Boolean}
 */
var DEBUG = false

/**
 * Alle objekter som skal kunne tegnes på canvas skal arve egenskapene til denne klassen, men denne klassen skal ikke konstruere objekter alene.
 * @param {Number} x - Global x-posisjon
 * @param {Number} y - Global y-posisjon
 * @constructor
 */
function DrawableObject (x, y) {
  this.global = { x: x || 0, y: y || 0 }
  this.color = {
    stroke: 'white',
    fill: 'black'
  }
  this.local = {}
  this.rotation = 0
  this.scale = { x: 1, y: 1 }
  this.stroke = true
  this.lineWidth = 2
  this.fill = true
  this.isOutOfBounds = false
  this.isAlive = true
  this.events = {
    'onupdate': false,
    'ondraw': false
  }
}

/**
 * Oppdaterer eventene i DrawableObject, altså sjekker om det er definert et event for 'onupdate' og kaller dette
 * @param dt - Delta-tid
 */
DrawableObject.prototype.update = function (dt) {
  if (this.events['onupdate']) this.events['onupdate'].call(this, dt)
}

/**
 * Sjekker om det er noen eventer som skal kjøres 'ondraw'
 * @param ctx - Gjeldene grafiske context
 */
DrawableObject.prototype.draw = function (ctx) {
  if (this.events['ondraw']) this.events['ondraw'].call(this, ctx)
}

/**
 * Skalerer, forflytter og roterer konteksten slik at tilbakekall-funksjonen kan inneholde lokale verdier i forhold til transmuteringene fra DrawableObject.
 * @param ctx - Gjeldene kontekst
 * @param callback - Tegningsfunksjon som tar inn en kontekst
 */
DrawableObject.prototype.prepAndDraw = function (ctx, callback) {
  ctx.save()
  ctx.scale(this.scale.x, this.scale.y)
  ctx.translate(this.global.x, this.global.y)
  ctx.rotate(this.rotation)
  if (this.fill) ctx.fillStyle = this.color.fill
  if (this.stroke) {
    ctx.lineWidth = this.lineWidth
    ctx.strokeStyle = this.color.stroke
  }
  if (callback) callback.call(this, ctx)
  ctx.restore()
}

/**
 * Alle objekter som skal ha fart og akselerasjon må arve egenskapene til denne klassen, men denne klassen skal ikke konstruere objekter alene.
 * @param {Number} x - Global x-posisjon
 * @param {Number} y - Global y-posisjon
 * @augments DrawableObject
 * @constructor
 */
function MoveableObject (x, y) {
  DrawableObject.call(this, x, y)
  this.speed = { x: 0, y: 0, rotation: 0 }
  this.acceleration = { x: 0, y: 0, rotation: 0 }
  this.updateMovement = true
}

/**
 * Oppdaterer akselerasjon og hastighet
 * @param dt - Delta-tid
 */
MoveableObject.prototype.update = function (dt) {
  if (this.updateMovement) {
    // Oppdaterer hastighet
    this.speed.x += this.acceleration.x * dt
    this.speed.y += this.acceleration.y * dt
    this.speed.rotation += this.acceleration.rotation * dt
    // Oppdaterer posisjon
    this.global.x += this.speed.x * dt
    this.global.y += this.speed.y * dt
    this.rotation += this.speed.rotation * dt
  }
}

// Bruker extend til å utvide prototypen til MoveableObject
MoveableObject.prototype.extend(DrawableObject.prototype)

/**
 * Konstruerer tekst-objekter som kan tegnes på canvas.
 * @param {Number} x - Global x-posisjon
 * @param {Number} y - Global y-posisjon
 * @param {String} text - Teksten som skal vises i
 * @param {String} [color] - Fargen til teksten
 * @augments DrawableObject
 * @constructor
 */
function TextObject (x, y, text, color) {
  DrawableObject.call(this, x, y)
  this.text = text
  if (color) {
    this.color.stroke = color
    this.color.fill = color
  }
  this.local.x = 0
  this.local.y = 0
  this.font = {
    size: 16,
    family: "'Atari','Arial',sans-serif"
  }
  this.textAlign = 'start'
  this.textBaseline = 'top'
  this.stroke = false
  this.wrap = false
  this.maxWidth = 9999999
  this.lineSeparation = this.font.size / 3
}

/**
 * Legger inn nye linjer utifra maks bredde og ny-linje symbolet
 * @param ctx - Gjeldende kontekst
 */
TextObject.prototype.wrapText = function (ctx) {
  var lines = this.text.split('\n'),
    y = this.local.y

  for (var i = 0; i < lines.length; i++) {
    var words = lines[i].split(' ')
    var line = ''

    for (var n = 0; n < words.length; n++) {
      var testLine = line + words[n] + ' '
      var metrics = ctx.measureText(testLine)
      var testWidth = metrics.width
      if (testWidth > this.maxWidth && n > 0) {
        ctx.fillText(line, 0, y)
        line = words[n] + ' '
        y += this.font.size + this.lineSeparation
      } else {
        line = testLine
      }
    }

    ctx.fillText(line, 0, y)
    y += this.font.size + this.lineSeparation
  }
}

/**
 * Tegner teksten på gjeldende kontekst
 * @param ctx - Gjeldende kontekst
 */
TextObject.prototype.draw = function (ctx) {
  this.prepAndDraw(ctx, function (ctx) {
    ctx.font = this.font.size + 'px ' + this.font.family
    ctx.textAlign = this.textAlign
    ctx.textBaseline = this.textBaseline

    if (this.wrap) {
      this.wrapText(ctx)
    } else {
      if (this.fill) ctx.fillText(this.text, this.local.x, this.local.y)
      if (this.stroke) ctx.strokeText(this.text, this.local.x, this.local.y)
    }
  })
}

// Bruker extend til å utvide prototypen til TextObject
TextObject.prototype.extend(DrawableObject.prototype)

/**
 * Konstruerer en firkant som kan tegnes på canvas.
 * @param {Number} x - Global x-posisjon
 * @param {Number} y - Global y-posisjon
 * @param {object} pt1 - Lokal verdi for x og y til en av toppunktene i firkanten
 * @param {object} pt2 - Lokal verdi for x og y til toppunktet som er diagonalt ovenfor pt1 i firkanten
 * @param {String} [color] - Fargen til firkanten når den tegnes på canvas
 * @augments DrawableObject
 * @constructor
 */
function Rectangle (x, y, pt1, pt2, color) {
  DrawableObject.call(this, x, y)
  this.local = { pt1: pt1, pt2: pt2 }
  this.width = Math.abs(pt2.x - pt1.x)
  this.height = Math.abs(pt2.y - pt1.y)
  if (color) {
    this.color.stroke = color
    this.color.fill = color
  }
}

/**
 * Tegner firkanten på gjeldende kontekst
 * @param ctx - Gjeldende kontekst
 */
Rectangle.prototype.draw = function (ctx) {
  this.prepAndDraw(ctx, function (ctx) {
    if (this.fill) ctx.fillRect(this.local.pt1.x, this.local.pt1.y, this.width, this.height)
    if (this.stroke) ctx.strokeRect(this.local.pt1.x, this.local.pt1.y, this.width, this.height)
  })
}

// Bruker extend til å utvide prototypen til Rectangle
Rectangle.prototype.extend(DrawableObject.prototype)

/**
 * Konstruerer et objekt som holder styr på brukergrensesnittet og som kan tegne enkelt elementer på canvas.
 * @constructor
 */
function UI () {
  this.unclickable = []
  this.clickable = []
  this.events = {
    'onupdate': null,
    'ondraw': null
  }
}

/**
 * Legger til et objekt til UI objektet på angitt lag, navn og om det er trykkbart eller ikke.
 * @param {Number} atLayer - På lag nummer (Går fra 0 og oppover, der 0 er det øverste laget)
 * @param {Boolean} clickable - Er objektet trykkbart (Har det et "onclick" event og "collisionWithPoint" metode)
 * @param {String} name - Navnet til senere referanse
 * @param {DrawableObject} object - Et objekt som kan tegnes
 * @returns {DrawableObject} - Objektet som ble sent inn som parameter
 */
UI.prototype.addObject = function (atLayer, clickable, name, object) {
  var arr = (clickable ? this.clickable : this.unclickable)
  if (!arr[atLayer]) arr[atLayer] = {}
  arr[atLayer][name] = object
  return object
}

/**
 * Finner et objekt basert på input verdier
 * @param {String} name - Navnet til senere referanse
 * @param {Number} [atLayer] - På lag nummer (Går fra 0 og oppover, der 0 er det øverste laget)
 * @param {Boolean} [clickable] - Er objektet trykkbart (Har det et "onclick" event og "collisionWithPoint" metode)
 * @returns {DrawableObject} - Funnet objekt
 */
UI.prototype.getObject = function (name, clickable, atLayer) {
  var i, id, longest = Math.max(this.clickable.length, this.unclickable.length)
  if (!atLayer) atLayer = 0
  if (atLayer >= longest) return false
  for (i = atLayer || 0; i < longest; i++) {
    if ((clickable === true || clickable === undefined) && this.clickable[i]) {
      for (id in this.clickable[i]) {
        if (this.clickable[i].hasOwnProperty(id)) if (name == id) return this.clickable[i][id]
      }
    }
    if ((clickable === false || clickable === undefined) && this.unclickable[i]) {
      for (id in this.unclickable[i]) {
        if (this.unclickable[i].hasOwnProperty(id)) if (name == id) return this.unclickable[i][id]
      }
    }
  }
  return false
}

/**
 * Fjerner et objekt basert på input verdier
 * @param {String} name - Navnet til senere referanse
 * @param {Number} [atLayer] - På lag nummer (Går fra 0 og oppover, der 0 er det øverste laget)
 * @param {Boolean} [clickable] - Er objektet trykkbart (Har det et "onclick" event og "collisionWithPoint" metode)
 * @returns {Boolean} - Om vellykket
 */
UI.prototype.removeObject = function (name, clickable, atLayer) {
  var i, id, longest = Math.max(this.clickable.length, this.unclickable.length)
  if (!atLayer) atLayer = 0
  if (atLayer >= longest) return false
  for (i = atLayer || 0; i < longest; i++) {
    if ((clickable === true || clickable === undefined) && this.clickable[i]) {
      for (id in this.clickable[i]) {
        if (this.clickable[i].hasOwnProperty(id)) {
          if (name == id) {
            delete this.clickable[i][id]
            return true
          }
        }
      }
    }
    if ((clickable === false || clickable === undefined) && this.unclickable[i]) {
      for (id in this.unclickable[i]) {
        if (this.unclickable[i].hasOwnProperty(id)) {
          if (name == id) {
            delete this.unclickable[i][id]
            return true
          }
        }
      }
    }
  }
  return false
}

/**
 * Oppdaterer alle objekter i UI'en
 * @param dt - Delta-tid
 */
UI.prototype.update = function (dt) {
  if (this.events['onupdate']) this.events['onupdate'].call(this, dt)
  var i, id, longest = Math.max(this.clickable.length, this.unclickable.length)
  for (i = 0; i < longest; i++) {
    if (this.clickable[i]) {
      for (id in this.clickable[i]) {
        if (this.clickable[i].hasOwnProperty(id)) if (this.clickable[i][id].update) this.clickable[i][id].update(dt)
      }
    }
    if (this.unclickable[i]) {
      for (id in this.unclickable[i]) {
        if (this.unclickable[i].hasOwnProperty(id)) if (this.unclickable[i][id].update) this.unclickable[i][id].update(dt)
      }
    }
  }
}

/**
 * Tegner alle objekter i UI'en i rekkefølgen: layer_n --> layer_0
 * @param ctx - Gjeldende kontekst
 */
UI.prototype.draw = function (ctx) {
  if (this.events['ondraw']) this.events['ondraw'].call(this, ctx)
  var i, id, longest = Math.max(this.clickable.length, this.unclickable.length)
  for (i = longest - 1; i >= 0; i--) {
    if (this.clickable[i]) {
      for (id in this.clickable[i]) {
        if (this.clickable[i].hasOwnProperty(id)) if (this.clickable[i][id].draw) this.clickable[i][id].draw(ctx)
      }
    }
    if (this.unclickable[i]) {
      for (id in this.unclickable[i]) {
        if (this.unclickable[i].hasOwnProperty(id)) if (this.unclickable[i][id].draw) this.unclickable[i][id].draw(ctx)
      }
    }
  }
}

/**
 * Sjekker om alle klikkbare UI objekter kolliderer med punktet
 * @param {Object} pt - Objekt med x og y verdier
 * @returns {DrawableObject} - Hvis noe kolliderer så returneres det objektet, hvis ikke returneres false
 */
UI.prototype.checkCollisionWithPoint = function (pt) {
  var current_layer
  for (var i = 0; i < this.clickable.length; i++) {
    current_layer = this.clickable[i]
    for (var name in current_layer) {
      if (current_layer.hasOwnProperty(name)) {
        if (current_layer[name].collisionWithPoint(pt)) return current_layer[name]
      }
    }
  }
  return false
}

/**
 * Lager knapper som kan trykkes på med tekst inni.
 * @param {Number} x - Global x-posisjon
 * @param {Number} y - Global y-posisjon
 * @param {Number} width - Bredden til knappen
 * @param {Number} height - Høyden til knappen
 * @param {String} text - Teksten på knappen
 * @param {Boolean} [defineFromCenter] - Definer knappen utifra midtpunktet, altså at de globale verdiene angir midtpunktet i firkanten.
 * @param {String} [color] - Fargen på knappen
 * @augments DrawableObject
 * @constructor
 */
function Button (x, y, width, height, text, defineFromCenter, color) {
  DrawableObject.call(this, (defineFromCenter ? x : x + width / 2), (defineFromCenter ? y : y + height / 2))
  this.local.x = -width / 2
  this.local.y = -height / 2
  this.width = width
  this.height = height
  this.textObject = new TextObject(this.global.x, this.global.y, text)
  this.textObject.textBaseline = 'middle'
  this.textObject.textAlign = 'center'
  this.events = {
    'onclick': null,
    'onhover': null
  }
  this.fill = false
  if (color) {
    this.color.stroke = color
    this.color.fill = color
  }
}

/**
 * Oppdaterer knappen, da hovedsakelig posisjonen til teksten inne i knappen
 * @param dt - Delta tid
 */
Button.prototype.update = function (dt) {
  this.textObject.global.x = this.global.x
  this.textObject.global.y = this.global.y
}

/**
 * Tegner knappen på gjeldende kontekst
 * @param ctx - Gjeldende kontekst
 */
Button.prototype.draw = function (ctx) {
  this.prepAndDraw(ctx, function (ctx) {
    if (this.fill) ctx.fillRect(this.local.x, this.local.y, this.width, this.height)
    if (this.stroke) ctx.strokeRect(this.local.x, this.local.y, this.width, this.height)
  })
  this.textObject.draw(ctx)
}

/**
 * Ser om punktet kolliderer med knappen
 * @param {Object} pt - Objekt med x og y verdier
 * @returns {Boolean}
 */
Button.prototype.collisionWithPoint = function (pt) {
  return !(pt.x < this.global.x + this.local.x ||
        pt.x > this.global.x + this.local.x + this.width ||
        pt.y < this.global.y + this.local.y ||
        pt.y > this.global.y + this.local.y + this.height)
}

Button.prototype.extend(DrawableObject.prototype)

/**
 * En klasse som holder styr på bakken i spillet og kan tegne denne på canvas.
 * @param x - Global x-posisjon
 * @param y - Global y-posisjon
 * @param path - En array med objekter som har x og y verdier
 * @augments DrawableObject
 * @constructor
 */
function Terrain (x, y, path) {
  DrawableObject.call(this, x, y)
  this.path = path
  this.fill = false
  this.bonus_time_limit = 0
  this.lineWidth = 3
}

/**
 * Finner høyden til terrenget ved gitt x-verdi
 * @param x - x-verdi der man skal finne høyden
 * @returns {Number} - For y-verdien til gitt x-verdi
 */
Terrain.prototype.getTerrianHeight = function (x) {
  for (var i = 1; i < this.path.length; i++) {
    if (this.path[i - 1].x < x && x < this.path[i].x) return calc.geometry.interpolation(this.path[i - 1].x, this.path[i - 1].y, this.path[i].x, this.path[i].y, x)
  }
}

/**
 * Finner hellningen til bakken i gitt x-verdi
 * @param {Number} x - X-verdi
 * @returns {Number} - Stigning i punktet x
 */
Terrain.prototype.getGradient = function (x) {
  for (var i = 1; i < this.path.length; i++) {
    if (this.path[i - 1].x < x && x < this.path[i].x) return calc.geometry.gradient(this.path[i - 1], this.path[i])
  }
}

/**
 * Tegner terrenget på gitt kontekst
 * @param ctx - Gitt kontekst
 */
Terrain.prototype.draw = function (ctx) {
  this.prepAndDraw(ctx, function (ctx) {
    ctx.beginPath()
    ctx.moveTo(this.path[0].x, this.path[0].y)
    for (var i = 1; i < this.path.length; i++) {
      ctx.lineTo(this.path[i].x, this.path[i].y)
    }
    if (this.stroke) ctx.stroke()
    if (this.fill) ctx.fill()
  })
}

Terrain.prototype.extend(DrawableObject.prototype)

/**
 * Konstruerer objektet som symboliserer spilleren, altså månelanderen, og kan tegne denne på canvas.
 * @param x - Global x-posisjon
 * @param y - Global y-posisjon
 * @param [width] - Bredden til landeren, hvis ikke definert så er standaren 100
 * @param [height] - Høyden til landeren, hvis ikke definert så er standaren 100
 * @augments MoveableObject
 * @constructor
 */
function Lander (x, y, width, height) {
  MoveableObject.call(this, x, y)
  this.width = width || 100
  this.height = height || 100
  this.fill = false
  this.color.fill = 'white'
  this.lineWidth = 6
  this.fuel = CONST.LANDER.STARTING_FUEL
  this.isExploded = false

  this.thruster = {
    sound: new Sound('Thrusters.wav'),
    x: 0,
    y: 0,
    cache: {
      cos: 1,
      sin: 0
    },
    rotation: 0,
    amount: 0,
    thrust: function (amount, conserve) {
      this.amount = amount + (conserve ? this.amount : 0)
      if (this.amount > this.amount_limit) this.amount = this.amount_limit
      else if (this.amount < 0) this.amount = 0
      this.update(true)
    },
    update: function (usePrev) {
      if (usePrev !== true) {
        this.cache.cos = Math.cos(this.rotation)
        this.cache.sin = Math.sin(this.rotation)
      }
      this.x = this.cache.sin * this.amount
      this.y = this.cache.cos * this.amount
      this.sound.nodes.gainNode.gain.value = 0.3 * this.amount / this.amount_limit
    },
    amount_limit: 1.7 * CONST.PHYSICS.GRAVITATION,
    path2D: (function () {
      return new Path2D('M23.018 20.705l135.64 163.623-107.33-32.39 168.79 111.326L82.784 224.11l192.51 111.87-130.525-1.76 282.08 126.116c13.913 7.198 28.182 13.638 42.728 19.246l2.297.885 20.797 9.3-16.895-37.82c-3.67-9.115-7.69-18.094-12.03-26.926L338.312 144.24l1.094 129.362L228.352 82.393l38.482 136.49L155.906 50.668l31.684 106.467L23.018 20.705zm225.148 225.178c94.262 38.75 169.608 116.195 208.152 207.924-91.01-40.827-168.835-115.908-208.152-207.924z')
    })(),
    path2DOffset: { x: -550, y: -550 },
    path2DScale: { x: 2 * this.width / 512, y: 2 * this.height / 512 },
    path2DRotation: 5 * Math.PI / 4,
    draw: function (ctx) {
      ctx.save()
      ctx.rotate(this.path2DRotation)
      ctx.scale(this.path2DScale.x * this.amount / this.amount_limit, this.path2DScale.y * this.amount / this.amount_limit)
      ctx.translate(this.path2DOffset.x + 5 * Math.random() * 2 - 1, this.path2DOffset.y + 5 * Math.random() * 2 - 1)
      ctx.stroke(this.path2D)
      ctx.restore()
    }
  }

  this.thruster.sound.events.onloaded = function () {
    this.source.loop = true
    this.nodes.gainNode.gain.value = 0
    this.play()
  }

  this.explosion = {
    sound: new Sound('Explosion.wav'),
    global: { x: 0, y: 0 },
    path2D: (function () {
      return new Path2D('M340.625 18.438l-42.438 104.657-39.562-99.938L213.25 157l-75.97-54.78 14.22 92.53L24.53 27l108.095 202.032-72.094-36.344 59.532 171.188-88.906-12.53 55.25 72.06-52.47-12.03 103.626 78.75 1.875 2.47h240.188l110.28-151.376-52.03 5.468 56.406-67.562-71.718 36.03L459.97 203.22l-54.783 24.625-88.75 67.843 54.282-78.25 18.936-116.343-57.75 37.562 8.72-120.22zM310.312 204.25L296.72 317.127l82.53-21.5-59.47 57.625L376.907 395l-77.437-12.905 36.092 75.75-67-39.313-40.593 50.375-3.72-57.97-70.063 5.783 70.063-37.313-77.53-79.28 75.124 18.56-8.375-84.75 51.405 87.5 45.437-117.186z')
    })(),
    path2DOffset: { x: -512 / 2, y: -800 / 2 },
    path2DScale: { x: 4 * this.width / 512, y: 4 * this.height / 512 },
    path2DRotation: 0,
    animating: false,
    size: 0,
    animationPlaytime: 1.2,
    animateSize: (function () {
      var progress = 0.0001, dir = 1, playSound = true
      return function (dt) {
        if (playSound) {
          this.sound.play()
          playSound = false
        }
        this.animating = true
        if (progress > this.animationPlaytime / 2) dir = -1
        if (progress > 0) progress += dt * dir
        else {
          progress = 0
          this.animating = false
        }
        this.size = 2 * progress / this.animationPlaytime
      }
    })(),
    draw: function (ctx) {
      ctx.save()
      ctx.translate(this.global.x, this.global.y)
      ctx.scale(this.path2DScale.x * this.size, this.path2DScale.y * this.size)
      ctx.translate(this.path2DOffset.x + 4 * (Math.random() * 2 - 1), this.path2DOffset.y + 4 * (Math.random() * 2 - 1))
      ctx.rotate(this.path2DRotation)
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 5
      ctx.stroke(this.path2D)
      ctx.restore()
    }
  }

  this.path2DOffset = { x: -512 / 2, y: -512 / 2 }
  this.path2DScale = { x: this.width / 512, y: this.height / 512 }
  this.path2D = (function () {
    return new Path2D('M144 23c-9.282 0-17 7.718-17 17 0 5.99 3.224 11.317 8 14.35v40.46l-15.156 7.38L91.68 228.93l76.5-12.75 15.238-91.434 48.268-77.014L153 86.047V54.35c4.776-3.033 8-8.36 8-14.35 0-9.282-7.718-17-17-17zm112 19.832L202.62 128h106.76L256 42.832zM416 45c-24.96 0-45 20.04-45 45s20.04 45 45 45 45-20.04 45-45-20.04-45-45-45zm-135.686 2.732l48.268 77.014 15.068 90.414 76.637 13.617-17.135-77.105C374.586 145.708 353 120.287 353 90c0-2.263.126-4.497.36-6.7l-73.046-35.568zM416 71c9.282 0 17 7.718 17 17s-7.718 17-17 17-17-7.718-17-17 7.718-17 17-17zm-288 48h32v18h-32v-18zm64 89l16 32h96l16-32H192zm149.88 25.13l-39.46 92.067 91.148-13.35 25.967-64.92-77.656-13.798zm-171.468.925L92.51 247.04l25.922 64.806 89.494 13.11-37.514-90.9zM198.942 256l29.71 71.992L256 331.998l25.527-3.74L312.494 256h-113.55zm-84.962 73.385L58.15 455H32v18h64v-18H77.85l6.543-14.72c.154-.06.285-.122.486-.18 1.41-.413 3.09-.958 5.097-1.637 4.014-1.358 9.296-3.25 15.464-5.514 12.34-4.53 28.187-10.538 43.86-16.546 18.96-7.267 34.964-13.486 46.782-18.093L247 436.5V471h-23v18h64v-18h-23v-34.5l50.918-38.19c11.818 4.608 27.82 10.827 46.78 18.094 15.675 6.008 31.523 12.017 43.86 16.545 6.17 2.263 11.45 4.155 15.465 5.513 2.007.68 3.687 1.224 5.098 1.637.202.058.333.12.487.18L434.15 455H416v18h64v-18h-26.15l-55.83-125.613-18.493 2.71 38.096 85.717c-1.6-.578-3.097-1.116-4.86-1.763-12.184-4.47-27.99-10.462-43.622-16.454-14.304-5.483-28.13-10.84-39.288-15.176l24.304-48.608-21.715 3.18L314.44 375H265v-26.13l-9 1.32-9-1.32V375h-49.438l-18.003-36.008-21.718-3.18 24.304 48.608c-11.156 4.337-24.983 9.693-39.287 15.176-15.633 5.992-31.44 11.983-43.622 16.455-1.764.648-3.26 1.186-4.86 1.764l38.095-85.72-18.493-2.71zM219 393h28v21l-28-21zm46 0h28l-28 21v-21z')
  })()

  this.boundingRect = new Rectangle(x + this.width / 2, y + this.height / 2, {x: -this.width / 2, y: -this.height / 2}, {x: this.width / 2, y: this.height / 2})
}

/**
 * Sjekker om månelanderen har overlevd landingen basert på kriterier
 * @param terrain - Terrenget månelanderen har landet på
 * @returns {Boolean} - Om månelanderen har overlevd
 */
Lander.prototype.hasSurvivedLanding = function (terrain) {
  this.thruster.thrust(0)
  var terrainGradient = terrain.getGradient(this.global.x)
  if (Math.abs(this.speed.y) > CONST.LANDER.LANDING_REQUIREMENTS.SPEED.VERTICAL) return false
  if (Math.abs(this.speed.x) > CONST.LANDER.LANDING_REQUIREMENTS.SPEED.HORIZONTAL) return false
  if (Math.abs(terrainGradient) > CONST.LANDER.LANDING_REQUIREMENTS.GROUND_GRADIANT) return false
  if (Math.abs((this.rotation % 2 * Math.PI)) > CONST.LANDER.LANDING_REQUIREMENTS.ANGLE) return false
  this.rotation = 0
  return true
}

/**
 * Oppdaterer månelanderen
 * @param dt - Delta-tid
 */
Lander.prototype.update = function (dt) {
  // Oppdaterer posisjonen til rektangelet rundt landeren
  this.boundingRect.global.x = this.global.x
  this.boundingRect.global.y = this.global.y
  this.boundingRect.rotation = this.rotation

  // Fjerner like mye bensin som brukes per sekund
  this.fuel -= this.thruster.amount * dt
  if (this.fuel <= 0) {
    this.thruster.thrust(0)
    this.fuel = 0
  }

  // Oppdaterer rotasjonen til thrusteren, bare når rotasjonen endrer seg
  if (this.thruster.rotation != this.rotation) {
    this.thruster.rotation = this.rotation
    this.thruster.update(false)
  }

  // Oppdaterer akselerasjonen til landeren
  this.acceleration.y = CONST.PHYSICS.GRAVITATION - this.thruster.y
  this.acceleration.x = this.thruster.x

  // Spiller eksplosjonsanimasjonen
  if (this.isExploded) {
    this.explosion.global.x = this.global.x
    this.explosion.global.y = this.global.y
    this.explosion.animateSize(dt)
  }
}

/**
 * Tegner månelanderen og dens effekter
 * @param ctx - Gjeldende kontekst
 */
Lander.prototype.draw = function (ctx) {
  this.prepAndDraw(ctx, function (ctx) {
    if (!this.isExploded) {
      this.thruster.draw(ctx)

      ctx.scale(this.path2DScale.x, this.path2DScale.y)
      ctx.translate(this.path2DOffset.x, this.path2DOffset.y)
      if (this.stroke) ctx.stroke(this.path2D)
      if (this.fill) ctx.fill(this.path2D)
    }
  })
  if (this.explosion.animating) this.explosion.draw(ctx)

  if (DEBUG) this.boundingRect.draw(ctx)
  if (DEBUG) calc.geometry.point.draw(this.global, ctx, CONST.PHYSICS.METER / 2, 'white')
}

Lander.prototype.extend(MoveableObject.prototype)

/**
 * En funksjon som kan laste inn, legge til ulike "noder" og spille lyd
 * @param name - Navnet til lyden inne i ressursmappen for lyd (Se CONST.APP.RESOURCE_FOLDERS)
 * @constructor
 */
function Sound (name) {
  this.name = name
  this.url = CONST.APP.RESOURCE_FOLDERS.AUDIO + name
  this.buffer = null
  this.source = null
  this.nodes = {
    gainNode: App.audio.ctx.createGain()
  }
  this.events = {
    'onloaded': null
  }
  this.isLoaded = false
  this.load()
}

/**
 * Laster inn lyden asynkront og gjør den klar til å spilles
 */
Sound.prototype.load = function () {
  var request = new XMLHttpRequest()
  request.open('GET', this.url, true)
  request.responseType = 'arraybuffer'

  // Decode asynchronously
  request.onload = function () {
    App.audio.ctx.decodeAudioData(request.response, function (buffer) {
      this.buffer = buffer
      this.source = App.audio.ctx.createBufferSource() // creates a sound source
      this.source.buffer = buffer // tell the source which sound to play
      var prevNode = null
      for (var name in this.nodes) {
        if (this.nodes.hasOwnProperty(name)) {
          prevNode = this.nodes[name]
          this.source.connect(prevNode)
        }
      }
      prevNode.connect(App.audio.ctx.destination) // connect the source to the context's destination (the speakers)
      this.isLoaded = true
      if (this.events.onloaded) this.events.onloaded.call(this)
    }.bind(this), function () {
      console.error('Error loading song.')
    })
  }.bind(this)
  request.send()
}

/**
 * Spiller av lyden
 * @param atTime - Start verdi
 */
Sound.prototype.play = function (atTime) {
  this.source.start(atTime || 0)
}

/**
 * Stopper å spille lyden
 */
Sound.prototype.stop = function () {
  this.source.stop()
}

/**
 * Inneholder alle konstante variabler og kan brukes til å endre på spillet/justere mekanikker.
 * @type {Object}
 */
var CONST = {
  MAPS: null,
  GAME: {
    SCORES: {
      FUEL_WORTH: 3,
      BONUS_TIME_WORTH: 1
    }
  },
  CONTROLS: {
    THRUST: {
      INCREASE: 'W',
      DECREASE: 'S'
    },
    ROTATE: {
      LEFT: 'A',
      RIGHT: 'D'
    }
  },
  APP: {
    RESOURCE_FOLDERS: {
      AUDIO: 'res/sounds/'
    },
    TITLE: 'Maanelander',
    SIZE: {
      WIDTH: 700,
      HEIGHT: 500,
      FIT_SCREEN: false
    }
  },
  PHYSICS: {
    METER: 4,
    GRAVITATION: 6.5
  },
  LANDER: {
    LANDING_REQUIREMENTS: {
      ANGLE: 0.8,
      SPEED: {
        VERTICAL: 11,
        HORIZONTAL: 4
      },
      GROUND_GRADIANT: 0.6
    }
  }
}

/**
 * Hoved applikasjonen, altså spillet.
 * @type {Object}
 */
var App = {
  canvases: {
    foreground: null,
    UI: null,
    tmp: document.createElement('canvas')
  },
  ctxs: {},
  audio: {
    ctx: null
  },
  animationID: null,
  clock: {
    startTime: Date.now(),
    lastTime: Date.now(),
    currentTime: Date.now(),
    multiplicator: 1,
    delta: 0,
    totalTime: function () {
      return Date.now() - this.startTime
    },
    update: function () {
      this.currentTime = Date.now()
      this.delta = ((this.currentTime - this.lastTime) / 1000) * this.multiplicator
      this.lastTime = this.currentTime
    }
  }, // Klokken som holder styr på tiden (Som nevnt i dokumentasjon)
  stateHandler: {
    current: null,
    states: {
      MENU: {
        events_last_tick: [],
        events: {
          'onclick': function (e, state) {
            var mouseUIPos = calc.input.mouse.getPos(e, App.canvases.UI)
            var res = state.UI.checkCollisionWithPoint(mouseUIPos)
            if (res) res.events.onclick.call(res, e, state)
          },
          'onmousemove': function (e, state) {
            var mouseUIPos = calc.input.mouse.getPos(e, App.canvases.UI)
            var res = state.UI.checkCollisionWithPoint(mouseUIPos)
            if (res) App.canvases.UI.style.cursor = 'pointer'
            else App.canvases.UI.style.cursor = 'default'
          }
        },
        UI: new UI(),
        init: function (options) {
          App.canvases.UI.style.cursor = 'default'

          if (options.message) {
            var overlay = this.UI.addObject(2, false, 'overlay', new Rectangle(0, 0, {x: 0, y: 0}, {x: App.width, y: App.height}, 'rgba(0,0,0,0.7)'))

            var message_box = this.UI.addObject(1, false, 'message_box', new Rectangle(App.width / 2, App.height / 3, {x: -200, y: -100}, {x: 200, y: 100}, 'white'))
            message_box.color.fill = 'black'

            var message_text = this.UI.addObject(0, false, 'message_text', new TextObject(App.width / 2, App.height * 2 / 10, options.message, 'white'))
            message_text.textAlign = 'center'
            message_text.textBaseline = 'middle'
            message_text.font.size = 12
            message_text.wrap = true
            message_text.maxWidth = 380

            var ok_button = this.UI.addObject(0, true, 'ok_button', new Button(App.width / 2, App.height * 37 / 80, 90, 45, 'OK', true, 'white'))
            ok_button.textObject.color.fill = 'white'
            ok_button.events.onclick = function (e, state) {
              this.fill = true
              this.color.fill = 'white'
              this.textObject.color.fill = 'black'
              setTimeout(function () {
                state.UI.removeObject('overlay')
                state.UI.removeObject('message_box')
                state.UI.removeObject('message_text')
                state.UI.removeObject('ok_button')
              }, 200)
            }
          }

          // Hoved overskrift
          var headline = this.UI.addObject(5, false, 'headline', new TextObject(0, 0, CONST.APP.TITLE, 'white'))
          headline.textBaseline = 'middle'
          headline.textAlign = 'center'
          headline.font.size = 24
          headline.events.onupdate = function (dt) {
            this.global.x = App.width / 2
            this.global.y = App.height / 3
          }

          // Start knapp
          var start_button = this.UI.addObject(5, true, 'start_button', new Button(App.width / 2, App.height / 2, 100, 40, 'START', true, 'white'))
          start_button.textObject.color.fill = 'white'
          start_button.events.onclick = function (e) {
            this.fill = true
            this.textObject.color.fill = 'black'
            setTimeout(function () {
              App.stateHandler.change(App.stateHandler.states.IN_GAME, { showTutorial: false, chooseLevel: false, levelNumber: 1 })
            }, 200)
          }

          // Instruksjonsknappen
          var how_to_play_button = this.UI.addObject(5, true, 'how_to_play_button', new Button(App.width / 2, App.height * 5 / 8, 250, 40, 'INSTRUKSJONER', true, 'white'))
          how_to_play_button.textObject.color.fill = 'white'
          how_to_play_button.events.onclick = function (e) {
            this.fill = true
            this.textObject.color.fill = 'black'
            setTimeout(function () {
              App.stateHandler.change(App.stateHandler.states.IN_GAME, { showTutorial: true, mapName: 'TUTORIAL0' })
            }, 200)
          }

          // Editor-knappen
          var editor_button = this.UI.addObject(5, true, 'editor_button', new Button(App.width / 2, App.height * 6 / 8, 120, 40, 'EDITOR', true, 'white'))
          editor_button.textObject.color.fill = 'white'
          editor_button.events.onclick = function (e) {
            this.fill = true
            this.textObject.color.fill = 'black'
            setTimeout(function () {
              App.stateHandler.change(App.stateHandler.states.EDITOR)
            }, 200)
          }

          // Logoer og design på menyen
          var logo_lander = this.UI.addObject(10, false, 'logo_lander', new Lander(100, 100, 200, 200))
          logo_lander.events.onupdate = function (dt) {
            if (this.global.y + this.height / 2 > App.height || dt == 0) {
              this.acceleration.y = 0
              this.speed.y = 0
              this.global.y = -this.height / 2 + App.height
            }
          }

          var logo_lander2 = this.UI.addObject(10, false, 'logo_lander2', new Lander(App.width - 100, 100, 200, 200))
          logo_lander2.events.onupdate = function (dt) {
            if (this.global.y + this.height / 2 > App.height || dt == 0) {
              this.acceleration.y = 0
              this.speed.y = 0
              this.global.y = -this.height / 2 + App.height
            }
          }
        },
        update: function (dt) {
          this.UI.update(dt)
        },
        draw: function () {
          this.UI.draw(App.ctxs.UI)
        }
      },
      IN_GAME: {
        sounds: {},
        current_options: null,
        player: {
          score: 0,
          startTime: 0,
          endTime: 0,
          playTime: 0,
          playing: true,
          calculateScore: function (lander, terrain) {
            this.score = Math.floor(lander.fuel * CONST.GAME.SCORES.FUEL_WORTH + (this.playTime < terrain.bonus_time_limit ? (this.playTime - terrain.bonus_time_limit) * CONST.GAME.SCORES.BONUS_TIME_WORTH : 0))
          }
        },
        events_last_tick: [],
        events: {
          'onkeydown': function (e, state) {
            if (!state.keys[String.fromCharCode(e.keyCode).toUpperCase()]) state.keys[String.fromCharCode(e.keyCode).toUpperCase()] = true
          },
          'onkeyup': function (e, state) {
            state.keys[String.fromCharCode(e.keyCode).toUpperCase()] = false
          },
          'onclick': function (e, state) {
            var mouseUIPos = calc.input.mouse.getPos(e, App.canvases.UI)
            var res = state.UI.checkCollisionWithPoint(mouseUIPos)
            if (res) res.events.onclick.call(res, e, state)
          },
          'onmousemove': function (e, state) {
            var mouseUIPos = calc.input.mouse.getPos(e, App.canvases.UI)
            var res = state.UI.checkCollisionWithPoint(mouseUIPos)
            if (res) App.canvases.UI.style.cursor = 'pointer'
            else App.canvases.UI.style.cursor = 'default'
          },
          'landerHitGround': function (e, state) {
            state.player.endTime = Date.now()
            state.player.playing = false
            e.lander.thruster.sound.stop()

            var title, message, survived = false
            if (e.lander.hasSurvivedLanding(e.terrain)) {
              state.player.calculateScore(e.lander, e.terrain)
              state.sounds.hasLanded.play()
              title = 'GRATULERER!'
              message = 'Du fikk ' + state.player.score + ' poeng.\nVil du spille igjen eller gaa tilbake til menyen?'
              survived = true
            } else {
              title = 'DU EKSPLODERTE!'
              message = 'Ingen poeng for det. Bedre lykke neste gang!\nPS! Husk at det er en dyr romsonde du styrer, bruk hodet!'
              e.lander.isExploded = true
            }
            setTimeout(function () {
              var overlay = state.UI.addObject(3, false, 'overlay', new Rectangle(0, 0, {x: 0, y: 0}, {x: App.width, y: App.height}, 'rgba(0,0,0,0.8)'))

              var post_game_title = state.UI.addObject(0, false, 'post_game_title', new TextObject(App.width / 2, App.height / 3, title, 'white'))
              post_game_title.textBaseline = 'middle'
              post_game_title.textAlign = 'center'
              post_game_title.font.size = 20

              var post_game_message = state.UI.addObject(0, false, 'post_game_message', new TextObject(App.width / 2, App.height * 2 / 5, message, 'white'))
              post_game_message.textBaseline = 'middle'
              post_game_message.textAlign = 'center'
              post_game_message.wrap = true
              post_game_message.font.size = 11

              var play_again_button = state.UI.addObject(0, true, 'play_again_button', new Button(App.width / 3, App.height * 2 / 3, 190, 50, 'SPILL IGJEN', true, 'white'))
              play_again_button.textObject.color.fill = 'white'
              play_again_button.events.onclick = function (e, state) {
                this.fill = true
                this.textObject.color.fill = 'black'
                setTimeout(function () {
                  App.stateHandler.change(App.stateHandler.states.IN_GAME, { showTutorial: false, mapName: App.stateHandler.states.IN_GAME.current_options.mapName })
                }, 200)
              }

              var quit_to_menu_button = state.UI.addObject(0, true, 'quit_to_menu_button', new Button(App.width * 2 / 3, App.height * 2 / 3, 220, 50, 'GAA TIL MENYEN', true, 'white'))
              quit_to_menu_button.textObject.color.fill = 'white'
              quit_to_menu_button.events.onclick = function (e, state) {
                this.fill = true
                this.textObject.color.fill = 'black'
                setTimeout(function () {
                  App.stateHandler.change(App.stateHandler.states.MENU)
                }, 200)
              }

              if (survived) {
                var next_level_button = state.UI.addObject(0, true, 'next_level_button', new Button(App.width / 2, App.height * 5 / 6, 220, 50, 'NESTE BANE', true, 'white'))
                next_level_button.textObject.color.fill = 'white'
                next_level_button.events.onclick = function (e, state) {
                  this.fill = true
                  this.textObject.color.fill = 'black'
                  setTimeout(function () {
                    App.stateHandler.change(App.stateHandler.states.IN_GAME, {
                      showTutorial: false,
                      chooseLevel: false,
                      mapName: null,
                      levelNumber: state.current_options.levelNumber + 1
                    })
                  }, 200)
                }
              }
            }, 1000)
          }
        },
        UI: new UI(),
        keys: {},
        key_events: {},
        gameObjects: [],
        init: function (options) {
          this.sounds.liftOff = new Sound('WeHaveLiftOff.wav')
          this.sounds.hasLanded = new Sound('TheEagleHasLanded.wav')

          this.current_options = options
          this.player.startTime = Date.now()
          this.player.endTime = Date.now()
          this.player.playing = true
          App.canvases.UI.style.cursor = 'default'

          App.clock.multiplicator = 0
          if (options.chooseLevel) {
            var allLevels = '', first = true
            for (var map_name in CONST.MAPS) {
              if (CONST.MAPS.hasOwnProperty(map_name)) {
                allLevels += (!first ? ', ' : '') + map_name
                first = false
              }
            }
            do {
              var ans = prompt('Hvilket bane vil du spille?\nDu kan velge mellom:\n\n' + allLevels)
              if (ans === null) break
            } while (!CONST.MAPS.hasOwnProperty(ans))
            if (ans !== null) options.mapName = ans
            else {
              App.stateHandler.change(App.stateHandler.states.MENU)
              return
            }
            alert('Banen ' + options.mapName + ' ble valgt.\nLykke til!')
          }

          if (options.mapName == null && options.levelNumber) {
            options.mapName = 'LEVEL' + options.levelNumber.toString()
          } else if (options.mapName) options.levelNumber = parseInt(options.mapName.match(/(\d+)/))

          if (!CONST.MAPS[options.mapName]) {
            App.stateHandler.change(App.stateHandler.states.MENU, { message: 'Tusen takk for at du spilte ' + CONST.APP.TITLE + '!\n\nVi ses blant stjernene.'})
            return
          }

          // Lager både lander og terrain som symboliserer månelanderen og bakken (Noen av verdien definert i maps.json)
          var lander = new Lander(CONST.MAPS[options.mapName].LANDER.STARTING_POS.X, CONST.MAPS[options.mapName].LANDER.STARTING_POS.Y, 5 * CONST.PHYSICS.METER, 5 * CONST.PHYSICS.METER),
            terrain = new Terrain(0, 0, CONST.MAPS[options.mapName].PATH)

          terrain.bonus_time_limit = CONST.MAPS[options.mapName].BONUS_TIME_LIMIT

          lander.fuel = CONST.MAPS[options.mapName].LANDER.STARTING_FUEL
          lander.events.onupdate = function () {
            var groundY = terrain.getTerrianHeight(this.global.x)
            if (this.boundingRect.global.y + this.boundingRect.local.pt2.y > groundY) {
              this.global.y = -this.width / 2 + groundY
              lander.updateMovement = false
              App.stateHandler.current.events_last_tick.push({event: {lander: lander, terrain: terrain}, event_type: 'landerHitGround'})
            } else if (this.global.y - this.height / 2 < 0) {
              this.acceleration.y = 0
              this.speed.y = 0
              this.global.y = this.height / 2
            }

            if (this.global.x - this.width / 2 < 0) {
              this.acceleration.x = 0
              this.speed.x = 0
              this.global.x = this.width / 2
            } else if (this.global.x + this.width / 2 > App.width) {
              this.acceleration.x = 0
              this.speed.x = 0
              this.global.x = -this.width / 2 + App.width
            }
          }

          this.gameObjects.push(lander)
          this.gameObjects.push(terrain)

          // Definerer kontrollene
          this.key_events[CONST.CONTROLS.THRUST.INCREASE] = function (dt) {
            lander.thruster.thrust(CONST.PHYSICS.METER * dt, true)
          }
          this.key_events[CONST.CONTROLS.THRUST.DECREASE] = function (dt) {
            lander.thruster.thrust(-CONST.PHYSICS.METER * dt, true)
          }
          this.key_events[CONST.CONTROLS.ROTATE.LEFT] = function (dt) {
            lander.rotation -= CONST.PHYSICS.METER / 5 * dt
          }
          this.key_events[CONST.CONTROLS.ROTATE.RIGHT] = function (dt) {
            lander.rotation += CONST.PHYSICS.METER / 5 * dt
          }

          var startGame = function () {
            var level_headline = this.UI.addObject(5, false, 'level_headline', new TextObject(App.width / 2, App.height * 3 / 12, 'Level ' + options.levelNumber, 'white'))
            level_headline.textAlign = 'center'
            level_headline.textBaseline = 'middle'
            if (this.sounds.liftOff.isLoaded) {
              this.sounds.liftOff.play()
              setTimeout(function () {
                App.clock.multiplicator = 1
                this.UI.removeObject('level_headline', false, 5)
              }.bind(this), 3300)
            } else setTimeout(startGame, 50)
          }.bind(this)

          // Lager UI'en som vises i spillet
          var UIText = {
            speed_vertical: {
              value: this.UI.addObject(5, false, 'speed_vertical_value', new TextObject(App.width - 90, 25, '0', 'white')),
              label: this.UI.addObject(5, false, 'speed_vertical_label', new TextObject(App.width - 330, 25, 'Vertikal hastighet', 'white'))
            },
            speed_horizontal: {
              value: this.UI.addObject(5, false, 'speed_horizontal_value', new TextObject(App.width - 90, 50, '0', 'white')),
              label: this.UI.addObject(5, false, 'speed_horizontal_label', new TextObject(App.width - 330, 50, 'Horisontal hastighet', 'white'))
            },
            altitude: {
              value: this.UI.addObject(5, false, 'altitude_value', new TextObject(App.width - 90, 75, '0', 'white')),
              label: this.UI.addObject(5, false, 'altitude_label', new TextObject(App.width - 330, 75, 'Hoeyde', 'white'))
            },
            score: {
              value: this.UI.addObject(5, false, 'score_value', new TextObject(180, 25, '0', 'white')),
              label: this.UI.addObject(5, false, 'score_label', new TextObject(40, 25, 'Poengsum', 'white'))
            },
            fuel: {
              value: this.UI.addObject(5, false, 'fuel_value', new TextObject(180, 50, '0', 'white')),
              label: this.UI.addObject(5, false, 'fuel_label', new TextObject(40, 50, 'Bensin', 'white'))
            },
            time: {
              value: this.UI.addObject(5, false, 'time_value', new TextObject(180, 75, '00:00', 'white')),
              label: this.UI.addObject(5, false, 'time_label', new TextObject(40, 75, 'Tid', 'white'))
            }
          }

          for (var name in UIText) {
            if (UIText.hasOwnProperty(name)) {
              UIText[name].value.font.size = 11
              UIText[name].label.font.size = 11
            }
          }

          this.UI.events.onupdate = function (dt) {
            UIText.speed_vertical.value.text = (lander.speed.y / CONST.PHYSICS.METER).toFixed(1) * -1 + ' m/s'
            UIText.speed_horizontal.value.text = (lander.speed.x / CONST.PHYSICS.METER).toFixed(1) + ' m/s'
            var cache
            UIText.altitude.value.text = ((cache = Math.floor((terrain.getTerrianHeight(lander.global.x) - lander.global.y - lander.height / 2) / CONST.PHYSICS.METER)) > 0 ? cache : 0) + ' m'
            UIText.fuel.value.text = Math.floor(lander.fuel) + ' liter'
            UIText.time.value.text = calc.clock.secondsToMMSS(App.stateHandler.current.player.playTime)
            UIText.score.value.text = App.stateHandler.current.player.score
          }

          // Lager en tutorial som kjøres hvis det er spesifisert i stateOptions
          if (options.showTutorial) {
            App.clock.multiplicator = 0

            var tutorialUI = {
              overlay: this.UI.addObject(3, false, 'tutorial_overlay', new Rectangle(0, 0, {x: 0, y: 0}, {x: App.width, y: App.height}, 'rgba(0,0,0,0.8)')),
              box: this.UI.addObject(2, false, 'tutorial_box', new Rectangle(App.width / 2, App.height * 3 / 7, {x: -230, y: -140}, {x: 230, y: 140}, 'rgba(0,0,0,0.8)')),
              title: this.UI.addObject(1, false, 'tutorial_title', new TextObject(App.width / 2, App.height / 4, '', 'white')),
              message: this.UI.addObject(1, false, 'tutorial_message', new TextObject(App.width / 2, App.height * 11 / 32, '', 'white')),
              knapp: this.UI.addObject(1, true, 'tutorial_knapp', new Button(App.width / 2, App.height * 5 / 8, 140, 40, 'NESTE', true, 'white'))
            }

            tutorialUI.box.color.stroke = 'white'
            tutorialUI.box.lineWidth = 4

            tutorialUI.title.textBaseline = 'middle'
            tutorialUI.title.textAlign = 'center'
            tutorialUI.title.maxWidth = 400
            tutorialUI.title.wrap = true

            tutorialUI.message.textBaseline = 'middle'
            tutorialUI.message.textAlign = 'center'
            tutorialUI.message.maxWidth = 400
            tutorialUI.message.font.size = 12
            tutorialUI.message.wrap = true

            tutorialUI.knapp.textObject.color.fill = 'white'

            var slides = [
              {
                title: 'Velkommen til ' + CONST.APP.TITLE,
                message: 'Du skal faa kontrollere en hoeymoderne maanelander som skal utforske nye planeter. Men foer morroa begynner, saa maa du laere deg hvordan den skal styres!'
              },
              {
                title: 'AA bruke rakettene 1',
                message: 'En viktig del av landingen er avpassing av fart i vertikal retning. For aa faa stoerre oppdrift trykker man paa:\n\n' + CONST.CONTROLS.THRUST.INCREASE
              },
              {
                title: '',
                message: 'Vaar naavaerende romsonde taaler bare nedslag paa om lag ' + (CONST.LANDER.LANDING_REQUIREMENTS.SPEED.VERTICAL / CONST.PHYSICS.METER).toFixed(1) + ' meter i sekundet.'
              },
              {
                title: 'AA bruke rakettene 2',
                message: 'Men for stor oppdrift er jo ikke bra, vi skal jo lande! Derfor kan du minke oppdriften med: \n\n' + CONST.CONTROLS.THRUST.DECREASE
              },
              {
                title: 'Planeter er ikke flate',
                message: 'Selv om man skulle oenske planeten var helt flat slik at man kunne landet enkelt, saa er de ikke det. Derfor kan du rotere romsonden med:\n\n' + CONST.CONTROLS.ROTATE.LEFT + ' og ' + CONST.CONTROLS.ROTATE.RIGHT
              },
              {
                title: 'Bensin koster penger',
                message: 'Den allerede dyre romsonden sluker dyrt rakett-drivstoff. Derfor saa boer du proeve aa bruke saa lite drivstoff som mulig. Du vil bli beloennet for dette.'
              },
              {
                title: 'Tid er penger',
                message: 'Ikke bare maa du bruke lite drivstoff, men du boer ogsaa bruke saa lite tid som mulig. Tid er penger (og poeng).'
              },
              {
                title: 'Lykke til!',
                message: 'Som sagt er ikke planeter flate, med det er landingsbasen vaar. Proev deg fram!'
              }
            ]

            var nextSlide = (function () {
              var index = 0, len = slides.length
              return function () {
                if (index == len) {
                  for (var name in tutorialUI) {
                    if (tutorialUI.hasOwnProperty(name)) {
                      App.stateHandler.current.UI.removeObject('tutorial_' + name)
                    }
                  }
                  startGame()
                } else {
                  tutorialUI.title.text = slides[index].title
                  tutorialUI.message.text = slides[index].message
                }

                if (index < len) index++
              }
            })()

            nextSlide()
            tutorialUI.knapp.events.onclick = nextSlide
          } else startGame()
        },
        update: function (dt) {
          if (this.player.playing) this.player.playTime += dt
          for (var key_name in this.keys) if (this.keys.hasOwnProperty(key_name) && this.keys[key_name] && this.key_events[key_name]) this.key_events[key_name](dt)
          this.UI.update(dt)
          for (var i = 0; i < this.gameObjects.length; i++) {
            this.gameObjects[i].update(dt)
          }
        },
        draw: function () {
          this.UI.draw(App.ctxs.UI)
          for (var i = 0; i < this.gameObjects.length; i++) {
            this.gameObjects[i].draw(App.ctxs.foreground)
          }
        },
        reset: function () {
          this.UI = new UI()
          this.player.score = 0
          this.player.playTime = 0
          this.gameObjects = []
          this.keys = {}
        }
      },
      EDITOR: {
        UI: new UI(),
        path: [],
        events_last_tick: [],
        events: {
          'onclick': function (e, state) {
            var mousePos = calc.input.mouse.getPos(e, App.canvases.foreground)
            var res = state.UI.checkCollisionWithPoint(mousePos)
            if (res) res.events.onclick.call(res, e, state)
            else state.path.push(mousePos)
          },
          'onmousemove': function (e, state) {
            var mouseUIPos = calc.input.mouse.getPos(e, App.canvases.UI)
            var res = state.UI.checkCollisionWithPoint(mouseUIPos)
            if (res) App.canvases.UI.style.cursor = 'pointer'
            else App.canvases.UI.style.cursor = 'default'
          },
          'onkeyup': function (e, state) {
            if (e.keyCode == 82 && state.path.length > 0) {
              state.path = state.path.slice(0, state.path.length - 1)
            }
          }
        },
        init: function () {
          App.canvases.UI.style.cursor = 'default'

          this.path = []

          var overlay = this.UI.addObject(3, false, 'overlay', new Rectangle(0, 0, {x: 0, y: 0}, {x: App.width, y: App.height}, 'rgba(0,0,0,0.7)'))

          // Lager overskriften i editoren
          var headline = this.UI.addObject(2, false, 'headline', new TextObject(App.width / 2, App.height / 5, 'Velkommen til editoren', 'white'))
          headline.font.size = 20
          headline.textBaseline = 'middle'
          headline.textAlign = 'center'

          // Lager meldingen som vises i editoren
          var message = this.UI.addObject(2, false, 'message', new TextObject(App.width / 2, App.height / 3, 'Ved aa trykke rundt paa canvaset kan du lage en bane. For aa eksportere banen saa trykker du paa eksporter oppe i hoeyre hjoerne. Du kan bruke R til aa angre ditt nyligste punkt.', 'white'))
          message.font.size = 12
          message.textBaseline = 'middle'
          message.textAlign = 'center'
          message.wrap = true
          message.maxWidth = 400

          // Lager knappen som man kan fjerne teksten på skjermen med
          var ok_button = this.UI.addObject(2, true, 'ok_button', new Button(App.width / 2, App.height * 3 / 5, 165, 45, 'OK', true, 'white'))
          ok_button.textObject.color.fill = 'white'
          ok_button.events.onclick = function (e, state) {
            this.fill = true
            this.textObject.color.fill = 'black'
            setTimeout(function () {
              state.UI.removeObject('ok_button')
              state.UI.removeObject('overlay')
              state.UI.removeObject('headline')
              state.UI.removeObject('message')
            }, 200)
          }

          // Lager knappen som eksporterer kreasjonen
          var export_button = this.UI.addObject(5, true, 'export_button', new Button(App.width - 100, 37, 165, 45, 'EKSPORTER', true, 'white'))
          export_button.textObject.color.fill = 'white'
          export_button.events.onclick = function (e, state) {
            this.fill = true
            this.textObject.color.fill = 'black'
            setTimeout(function () {
              do {
                var level_name = prompt('Hva skal banen hete?\n\n(Bare store bokstaver fra A-Z og tall)')
                if (level_name === null) break
              } while (!/^[A-Z0-9]*$/.test(level_name))

              if (level_name !== null) {
                if (!CONST.MAPS[level_name]) {
                  var res = confirm('Er du sikker på at du vil lagre banen din som:\n\n' + level_name)
                  if (res) {
                    CONST.MAPS[level_name] = {}
                    CONST.MAPS[level_name].path = state.path
                    console.log(JSON.stringify(state.path))
                    alert('Bane lagret som:\n\n' + level_name + '\nUheldigvis bare midlertidig...')
                  } else alert('Bane ikke lagret.')
                } else alert('Denne banen finnes allerede. Prøv et annet navn.')
              }
              this.fill = false
              this.textObject.color.fill = 'white'
            }.bind(this), 200)
          }

          var to_menu_button = this.UI.addObject(5, true, 'to_menu_button', new Button(100, 37, 165, 45, 'TIl MENYEN', true, 'white'))
          to_menu_button.textObject.color.fill = 'white'
          to_menu_button.events.onclick = function (e, state) {
            this.fill = true
            this.textObject.color.fill = 'black'
            setTimeout(function () {
              App.stateHandler.change(App.stateHandler.states.MENU)
            }, 200)
          }
        },
        update: function (dt) {
          this.UI.update(dt)
        },
        draw: function () {
          this.UI.draw(App.ctxs.UI)
          if (this.path.length > 1) {
            App.ctxs.foreground.strokeStyle = 'white'
            App.ctxs.foreground.beginPath()
            App.ctxs.foreground.moveTo(this.path[0].x, this.path[0].y)
            for (var i = 1; i < this.path.length; i++) {
              App.ctxs.foreground.lineTo(this.path[i].x, this.path[i].y)
            }
            App.ctxs.foreground.stroke()
          }
        },
        reset: function () {}
      },
      TEST: {
        events_last_tick: [],
        events: {
        },
        init: function () {
        },
        update: function (dt) {
        },
        draw: function () {
        }
      }
    },
    prepare_state_events: function () {
      for (var event_type in this.current.events) {
        if (this.current.events.hasOwnProperty(event_type)) {
          (function (e_t) {
            document[e_t] = function (e) {
              this.current.events_last_tick.push({event: e, event_type: e_t})
            }.bind(this)
          }).call(this, event_type)
        }
      }
    },
    remove_state_events: function () {
      for (var event_type in this.current.events) {
        if (this.current.events.hasOwnProperty(event_type)) {
          document.removeEventListener(event_type, this.current.events[event_type])
        }
      }
    },
    change: function (newState, stateOptions) {
      if (this.current != null) {
        this.remove_state_events()
        if (this.current.reset) this.current.reset()
      }
      this.current = newState
      this.prepare_state_events()
      this.current.init(stateOptions || {})
    }
  }, // Håndterer de ulike tilstandene til applikasjonen (Som nevnt i dokumentasjon)
  width: CONST.APP.SIZE.WIDTH,
  height: CONST.APP.SIZE.HEIGHT,
  loadMaps: function () {
    calc.input.file.json('maps.json', function (json) {
      CONST.MAPS = JSON.parse(json)
    })
  },
  initCanvases: function () {
    for (var name in this.canvases) {
      if (this.canvases.hasOwnProperty(name)) {
        if (this.canvases[name] === null) this.canvases[name] = document.getElementById(name)
        if (this.canvases[name] instanceof HTMLCanvasElement) {
          this.canvases[name].width = App.width
          this.canvases[name].height = App.height
          this.ctxs[name] = this.canvases[name].getContext('2d')
        }
      }
    }
  },
  initAudioContext: function () {
    this.audio.ctx = new (window.AudioContext || window.webkitAudioContext)() // Definerer lyd kontekst. Webkit/blink browsers trenger prefix, Safari fungerer ikke uten window.
  },
  init: function () {
    this.initCanvases()
    this.initAudioContext()
    this.loadMaps()
    this.stateHandler.change(this.stateHandler.states.MENU)
  },
  handleInput: function () {
    if (this.stateHandler.current) {
      for (var i = 0; i < this.stateHandler.current.events_last_tick.length; i++) {
        var handler = this.stateHandler.current.events[this.stateHandler.current.events_last_tick[i].event_type]
        if (handler) handler(this.stateHandler.current.events_last_tick[i].event, this.stateHandler.current)
      }
      this.stateHandler.current.events_last_tick = []
    }
  },
  updateCanvasSizes: function () {
    for (var name in this.canvases) {
      if (this.canvases.hasOwnProperty(name)) {
        this.canvases[name].width = App.width
        this.canvases[name].height = App.height
      }
    }
  },
  updateSize: function () {
    this.width = window.innerWidth
    this.height = window.innerHeight
  },
  update: function () {
    this.clock.update()
    this.stateHandler.current.update(this.clock.delta)
    if (CONST.APP.SIZE.FIT_SCREEN) {
      this.updateSize()
      this.updateCanvasSizes()
    }
  },
  draw: function () {
    for (var name in this.ctxs) {
      if (this.ctxs.hasOwnProperty(name)) this.ctxs[name].clearRect(0, 0, this.ctxs[name].canvas.width, this.ctxs[name].canvas.height)
    }
    this.stateHandler.current.draw()
  },
  run: function () {
    this.handleInput()
    this.update()
    this.draw()
    this.animationID = requestAnimationFrame(this.run.bind(this))
  } // Spilløkken og funksjonen som kaller seg selv inn i "requestAnimationFrame"
}

document.addEventListener('DOMContentLoaded', function () {
  App.init()
  App.run()
})
