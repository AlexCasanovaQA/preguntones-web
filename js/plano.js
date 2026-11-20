/* Dibuja web/plano.json. No pide el puerto del juego. */
(function () {
  var SVG = "http://www.w3.org/2000/svg";
  var mapa = document.getElementById("plano-mapa");
  var cuando = document.getElementById("plano-cuando");
  var cuentas = document.getElementById("plano-cuentas");
  var ficha = document.getElementById("plano-ficha");
  var resultados = document.getElementById("plano-resultados");
  var listaEdificios = document.getElementById("plano-edificios");
  var campo = document.getElementById("plano-q");
  if (!mapa || !campo) {
    return;
  }

  var datos = null;
  var filtro = "todas";
  var consulta = "";
  var vista = null;
  var vistaManual = false;
  var limitesActuales = null;
  var textoPrevio = "";
  var marcada = "";
  var arrastre = null;

  function origen(m, indice) {
    if (indice >= 0) {
      return m.primero + indice * m.salto;
    }
    return -m.primero - m.lado + 1 - (-indice - 1) * m.salto;
  }

  function tocaSpawn(m, x, z) {
    var x1 = x + m.lado - 1;
    var z1 = z + m.lado - 1;
    function dentro(px, pz) {
      return Math.abs(px) <= m.spawn && Math.abs(pz) <= m.spawn;
    }
    return dentro(x, z) || dentro(x1, z) || dentro(x, z1) || dentro(x1, z1);
  }

  function plano(texto) {
    return String(texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function publicado() {
    return !!(datos && typeof datos.actualizado === "number" && datos.actualizado > 0);
  }

  function limites() {
    var m = datos.cuadricula;
    var minX = origen(m, m.desde);
    var maxX = origen(m, m.hasta) + m.lado;
    var minZ = origen(m, m.desde);
    var maxZ = origen(m, m.hasta) + m.lado;
    function sumar(x, z, w, h) {
      minX = Math.min(minX, x);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x + (w || 0));
      maxZ = Math.max(maxZ, z + (h || 0));
    }
    (datos.casillas || []).forEach(function (casilla) {
      sumar(casilla.x, casilla.z, casilla.w, casilla.h);
    });
    (datos.edificios || []).forEach(function (edificio) {
      sumar(edificio.x, edificio.z, 0, 0);
    });
    var pad = 24;
    return { x: minX - pad, y: minZ - pad, w: maxX - minX + pad * 2, h: maxZ - minZ + pad * 2 };
  }

  function aplicarVista() {
    if (!vista) {
      return;
    }
    mapa.setAttribute("viewBox", vista.x + " " + vista.y + " " + vista.w + " " + vista.h);
  }

  function verTodo() {
    vistaManual = false;
    vista = limitesActuales ? { x: limitesActuales.x, y: limitesActuales.y, w: limitesActuales.w, h: limitesActuales.h } : null;
    aplicarVista();
  }

  function zoom(factor, alrededor) {
    if (!vista || !limitesActuales) {
      return;
    }
    var siguiente = vista.w * factor;
    var tope = Math.max(limitesActuales.w, limitesActuales.h);
    if (siguiente < 48 || siguiente > tope * 1.2) {
      return;
    }
    var alto = vista.h * factor;
    var cx = alrededor ? alrededor.x : vista.x + vista.w / 2;
    var cy = alrededor ? alrededor.y : vista.y + vista.h / 2;
    var rx = (cx - vista.x) / vista.w;
    var ry = (cy - vista.y) / vista.h;
    vista = { x: cx - rx * siguiente, y: cy - ry * alto, w: siguiente, h: alto };
    vistaManual = true;
    aplicarVista();
  }

  function puntoDe(evento) {
    var ctm = mapa.getScreenCTM();
    if (!ctm) {
      return null;
    }
    var punto = mapa.createSVGPoint();
    punto.x = evento.clientX;
    punto.y = evento.clientY;
    return punto.matrixTransform(ctm.inverse());
  }

  function crear(nombre) {
    return document.createElementNS(SVG, nombre);
  }

  function casillaDe(clave) {
    var lista = datos && datos.casillas ? datos.casillas : [];
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].clave === clave) {
        return lista[i];
      }
    }
    return null;
  }

  function edificioDe(id) {
    var lista = datos && datos.edificios ? datos.edificios : [];
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id) {
        return lista[i];
      }
    }
    return null;
  }

  function visible(casilla) {
    if (filtro !== "todas" && casilla.estado !== filtro) {
      return false;
    }
    if (!consulta) {
      return true;
    }
    var texto = plano((casilla.nombre || "") + " " + (casilla.titulo || ""));
    return texto.indexOf(consulta) !== -1 && (casilla.estado === "casa" || (casilla.estado === "venta" && casilla.nombre));
  }

  function ponerFicha(nodo) {
    while (ficha.firstChild) {
      ficha.removeChild(ficha.firstChild);
    }
    ficha.appendChild(nodo);
  }

  function parrafo(texto) {
    var p = document.createElement("p");
    p.textContent = texto;
    return p;
  }

  function explicar(casilla) {
    var bloque = document.createElement("div");
    if (!casilla) {
      bloque.appendChild(parrafo("Pulsa una casilla, una casa o un edificio."));
      ponerFicha(bloque);
      return;
    }
    if (casilla.estado === "libre") {
      bloque.appendChild(parrafo("Parcela libre. En el juego la compra la pala de oro. La primera cuesta 250 duros; la siguiente, más."));
    } else if (casilla.estado === "reservada") {
      bloque.appendChild(parrafo("Reservada. La pala no la compra mientras dure. El nombre no sale aquí."));
    } else if (casilla.estado === "venta") {
      var venta = "En venta · " + casilla.precio + " duros.";
      if (casilla.nombre) {
        venta += " Casa de " + casilla.nombre + (casilla.titulo ? " · " + casilla.titulo : "") + ".";
      }
      bloque.appendChild(parrafo(venta));
    } else if (casilla.estado === "casa") {
      bloque.appendChild(parrafo("Casa de " + casilla.nombre + (casilla.titulo ? " · " + casilla.titulo : "") + "."));
    } else if (casilla.estado === "ocupada") {
      bloque.appendChild(parrafo("Tiene dueño. Esa persona no ha pedido salir en el plano."));
    } else if (casilla.estado === "edificio") {
      bloque.appendChild(parrafo(casilla.nombre + ". Está en la plaza."));
    } else {
      bloque.appendChild(parrafo("Esta casilla aún no tiene color. Libre, reservada y en venta salen cuando el servidor publica la lista."));
    }
    ponerFicha(bloque);
  }

  function enfocar(x, z) {
    vista = { x: x - 70, y: z - 70, w: 140, h: 140 };
    vistaManual = true;
    aplicarVista();
  }

  function marcar(id) {
    marcada = id || "";
    var piezas = mapa.querySelectorAll("[data-id]");
    for (var i = 0; i < piezas.length; i++) {
      piezas[i].classList.toggle("marcada", piezas[i].getAttribute("data-id") === marcada);
    }
  }

  function tenues() {
    var piezas = mapa.querySelectorAll(".casilla");
    for (var i = 0; i < piezas.length; i++) {
      var estado = piezas[i].getAttribute("data-estado");
      var clave = piezas[i].getAttribute("data-id");
      var casilla = casillaDe(clave);
      var apagada = filtro !== "todas" && estado !== filtro && estado !== "sin-datos";
      if (!apagada && consulta && casilla) {
        apagada = !visible(casilla);
      }
      if (!apagada && consulta && estado === "sin-datos") {
        apagada = true;
      }
      piezas[i].classList.toggle("tenue", apagada);
    }
  }

  function botonResultado(titulo, ayuda, alPulsar) {
    var item = document.createElement("li");
    var boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = titulo;
    if (ayuda) {
      var nota = document.createElement("span");
      nota.textContent = ayuda;
      boton.appendChild(document.createTextNode(" "));
      boton.appendChild(nota);
    }
    boton.addEventListener("click", alPulsar);
    item.appendChild(boton);
    return item;
  }

  function pintarListas() {
    while (resultados.firstChild) {
      resultados.removeChild(resultados.firstChild);
    }
    while (listaEdificios.firstChild) {
      listaEdificios.removeChild(listaEdificios.firstChild);
    }
    var encontrados = [];
    (datos.edificios || []).forEach(function (edificio) {
      var item = botonResultado(edificio.nombre, "", function () {
        filtro = "todas";
        sincronizarFiltros();
        marcar("edificio:" + edificio.id);
        explicar({ estado: "edificio", nombre: edificio.nombre });
        enfocar(edificio.x, edificio.z);
        tenues();
      });
      listaEdificios.appendChild(item);
      if (consulta && plano(edificio.nombre).indexOf(consulta) !== -1) {
        encontrados.push({ titulo: edificio.nombre, ayuda: "Edificio", x: edificio.x, z: edificio.z, id: "edificio:" + edificio.id, ficha: { estado: "edificio", nombre: edificio.nombre } });
      }
    });
    (datos.casillas || []).forEach(function (casilla) {
      var casa = casilla.estado === "casa" || (casilla.estado === "venta" && casilla.nombre);
      if (!casa) {
        return;
      }
      var titulo = casilla.titulo || casilla.nombre;
      var ayuda = casilla.titulo ? casilla.nombre : (casilla.estado === "venta" ? casilla.precio + " duros" : "");
      var coincide = !consulta || plano((casilla.nombre || "") + " " + (casilla.titulo || "")).indexOf(consulta) !== -1;
      var porFiltro = !consulta && filtro === "casa" && casilla.estado === "casa";
      if (consulta ? coincide : porFiltro) {
        encontrados.push({
          titulo: titulo,
          ayuda: ayuda,
          x: casilla.x + casilla.w / 2,
          z: casilla.z + casilla.h / 2,
          id: casilla.clave,
          ficha: casilla
        });
      }
    });
    if (!consulta && filtro !== "casa") {
      resultados.appendChild(botonResultado("Escribe un nombre", "o pulsa Casas", function () {
        campo.focus();
      }));
      return;
    }
    if (encontrados.length === 0) {
      var vacio = document.createElement("li");
      vacio.textContent = publicado() ? "Ninguna casa visible coincide." : "Todavía no hay casas publicadas.";
      resultados.appendChild(vacio);
      return;
    }
    encontrados.slice(0, 40).forEach(function (hallazgo) {
      resultados.appendChild(botonResultado(hallazgo.titulo, hallazgo.ayuda, function () {
        filtro = "todas";
        sincronizarFiltros();
        marcar(hallazgo.id);
        explicar(hallazgo.ficha);
        enfocar(hallazgo.x, hallazgo.z);
        tenues();
      }));
    });
  }

  function contar() {
    var n = { libre: 0, reservada: 0, venta: 0, casa: 0, ocupada: 0 };
    (datos.casillas || []).forEach(function (casilla) {
      if (Object.prototype.hasOwnProperty.call(n, casilla.estado)) {
        n[casilla.estado] += 1;
      }
    });
    if (!publicado()) {
      cuentas.textContent = "Las parcelas todavía no están publicadas. Los edificios de la plaza sí.";
      return;
    }
    function frase(cantidad, una, varias) {
      return cantidad + " " + (cantidad === 1 ? una : varias);
    }
    cuentas.textContent = [
      frase(n.libre, "libre", "libres"),
      frase(n.reservada, "reservada", "reservadas"),
      frase(n.venta, "en venta", "en venta"),
      frase(n.casa, "casa", "casas"),
      frase(n.ocupada, "ocupada", "ocupadas")
    ].join(" · ");
  }

  function fecha() {
    if (!publicado()) {
      cuando.textContent = "La página vuelve a leer la lista cada minuto. Esta copia aún no trae parcelas.";
      return;
    }
    var texto = new Date(datos.actualizado).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit"
    });
    cuando.textContent = "Lista del " + texto + ", hora de Madrid. Se vuelve a leer cada minuto.";
  }

  function dibujar() {
    while (mapa.firstChild) {
      mapa.removeChild(mapa.firstChild);
    }
    var m = datos.cuadricula;
    limitesActuales = limites();
    if (!vistaManual || !vista) {
      vista = { x: limitesActuales.x, y: limitesActuales.y, w: limitesActuales.w, h: limitesActuales.h };
    }
    aplicarVista();

    var spawn = crear("rect");
    spawn.setAttribute("x", String(-m.spawn));
    spawn.setAttribute("y", String(-m.spawn));
    spawn.setAttribute("width", String(m.spawn * 2 + 1));
    spawn.setAttribute("height", String(m.spawn * 2 + 1));
    spawn.setAttribute("class", "plano-spawn");
    spawn.setAttribute("data-id", "plaza");
    mapa.appendChild(spawn);

    if (!publicado()) {
      for (var i = m.desde; i <= m.hasta; i++) {
        for (var j = m.desde; j <= m.hasta; j++) {
          var x = origen(m, i);
          var z = origen(m, j);
          if (tocaSpawn(m, x, z)) {
            continue;
          }
          var hueco = crear("rect");
          hueco.setAttribute("x", String(x));
          hueco.setAttribute("y", String(z));
          hueco.setAttribute("width", String(m.lado));
          hueco.setAttribute("height", String(m.lado));
          hueco.setAttribute("class", "casilla casilla-sin-datos");
          hueco.setAttribute("data-estado", "sin-datos");
          hueco.setAttribute("data-id", i + "," + j);
          mapa.appendChild(hueco);
        }
      }
    }

    (datos.casillas || []).forEach(function (casilla) {
      if (!casilla || typeof casilla.x !== "number" || typeof casilla.z !== "number") {
        return;
      }
      var rect = crear("rect");
      rect.setAttribute("x", String(casilla.x));
      rect.setAttribute("y", String(casilla.z));
      rect.setAttribute("width", String(casilla.w || m.lado));
      rect.setAttribute("height", String(casilla.h || m.lado));
      rect.setAttribute("class", "casilla casilla-" + (casilla.estado || "ocupada"));
      rect.setAttribute("data-estado", casilla.estado || "");
      rect.setAttribute("data-id", casilla.clave);
      var titulo = crear("title");
      titulo.textContent = casilla.estado === "casa"
        ? "Casa de " + casilla.nombre
        : casilla.estado === "venta"
          ? "En venta, " + casilla.precio + " duros"
          : casilla.estado === "libre"
            ? "Libre"
            : casilla.estado === "reservada"
              ? "Reservada"
              : "Con dueño";
      rect.appendChild(titulo);
      mapa.appendChild(rect);
    });

    (datos.edificios || []).forEach(function (edificio) {
      if (!edificio || typeof edificio.x !== "number" || typeof edificio.z !== "number") {
        return;
      }
      var circulo = crear("circle");
      circulo.setAttribute("cx", String(edificio.x));
      circulo.setAttribute("cy", String(edificio.z));
      circulo.setAttribute("r", "8");
      circulo.setAttribute("class", "plano-edificio");
      circulo.setAttribute("data-tipo", "edificio");
      circulo.setAttribute("data-id", "edificio:" + edificio.id);
      var tituloEdificio = crear("title");
      tituloEdificio.textContent = edificio.nombre || edificio.id;
      circulo.appendChild(tituloEdificio);
      mapa.appendChild(circulo);
    });

    contar();
    fecha();
    tenues();
    pintarListas();
    if (marcada) {
      marcar(marcada);
    }
  }

  function elegir(objetivo) {
    if (!objetivo || !mapa.contains(objetivo)) {
      return;
    }
    var nodo = objetivo.closest ? objetivo.closest("[data-id]") : null;
    if (!nodo) {
      explicar(null);
      marcar("");
      return;
    }
    var id = nodo.getAttribute("data-id");
    marcar(id);
    if (id === "plaza") {
      var bloque = document.createElement("div");
      bloque.appendChild(parrafo("La plaza. Aquí apareces. Los puntos son los edificios."));
      ponerFicha(bloque);
      return;
    }
    if (id.indexOf("edificio:") === 0) {
      var edificio = edificioDe(id.slice(9));
      explicar(edificio ? { estado: "edificio", nombre: edificio.nombre } : null);
      return;
    }
    var casilla = casillaDe(id);
    if (casilla) {
      explicar(casilla);
      return;
    }
    explicar({ estado: "sin-datos" });
  }

  function sincronizarFiltros() {
    var botones = document.querySelectorAll("[data-filtro]");
    for (var i = 0; i < botones.length; i++) {
      botones[i].setAttribute("aria-pressed", botones[i].getAttribute("data-filtro") === filtro ? "true" : "false");
    }
  }

  function leer(texto) {
    var nuevo;
    try {
      nuevo = JSON.parse(texto);
    } catch (e) {
      cuando.textContent = "El plano no se ha podido leer.";
      return;
    }
    if (!nuevo || !nuevo.cuadricula || typeof nuevo.cuadricula.primero !== "number") {
      cuando.textContent = "El plano no trae la cuadrícula.";
      return;
    }
    datos = nuevo;
    if (!Array.isArray(datos.casillas)) {
      datos.casillas = [];
    }
    if (!Array.isArray(datos.edificios)) {
      datos.edificios = [];
    }
    dibujar();
  }

  function pedir() {
    fetch("plano.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (respuesta) {
        if (!respuesta.ok) {
          throw new Error("estado");
        }
        return respuesta.text();
      })
      .then(function (texto) {
        if (texto === textoPrevio && datos) {
          return;
        }
        textoPrevio = texto;
        leer(texto);
      })
      .catch(function () {
        cuando.textContent = "No he podido leer el plano.";
      });
  }

  campo.addEventListener("input", function () {
    consulta = plano(campo.value.trim());
    tenues();
    pintarListas();
  });
  var formulario = document.querySelector(".plano-buscar");
  if (formulario) {
    formulario.addEventListener("submit", function (evento) {
      evento.preventDefault();
    });
  }

  document.querySelectorAll("[data-filtro]").forEach(function (boton) {
    boton.addEventListener("click", function () {
      filtro = boton.getAttribute("data-filtro");
      sincronizarFiltros();
      tenues();
      pintarListas();
    });
  });

  document.getElementById("plano-acercar").addEventListener("click", function () {
    zoom(0.75, null);
  });
  document.getElementById("plano-alejar").addEventListener("click", function () {
    zoom(1.25, null);
  });
  document.getElementById("plano-todo").addEventListener("click", verTodo);

  mapa.addEventListener("pointerdown", function (evento) {
    if (!vista) {
      return;
    }
    arrastre = { x: evento.clientX, y: evento.clientY, vx: vista.x, vy: vista.y, movido: false };
    mapa.setPointerCapture(evento.pointerId);
  });
  mapa.addEventListener("pointermove", function (evento) {
    if (!arrastre || !vista) {
      return;
    }
    var rect = mapa.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    var dx = evento.clientX - arrastre.x;
    var dy = evento.clientY - arrastre.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      arrastre.movido = true;
    }
    var escala = vista.w / rect.width;
    vista.x = arrastre.vx - dx * escala;
    vista.y = arrastre.vy - dy * escala;
    vistaManual = true;
    aplicarVista();
  });
  mapa.addEventListener("pointerup", function (evento) {
    var fueArrastre = arrastre && arrastre.movido;
    arrastre = null;
    if (!fueArrastre) {
      elegir(evento.target);
    }
  });
  mapa.addEventListener("wheel", function (evento) {
    evento.preventDefault();
    zoom(evento.deltaY > 0 ? 1.12 : 0.88, puntoDe(evento));
  }, { passive: false });

  pedir();
  window.setInterval(pedir, 60000);
})();
