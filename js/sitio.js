/* Rellena [data-campo] desde IDENTIDAD. No hace falta para leer la página. */
(function () {
  var datos = window.IDENTIDAD;
  if (!datos) {
    return;
  }

  var campos = document.querySelectorAll("[data-campo]");
  for (var i = 0; i < campos.length; i++) {
    var nodo = campos[i];
    var clave = nodo.getAttribute("data-campo");
    if (!Object.prototype.hasOwnProperty.call(datos, clave)) {
      continue;
    }
    var valor = datos[clave];
    if (valor === null || typeof valor === "undefined") {
      continue;
    }
    valor = String(valor);
    var modo = nodo.getAttribute("data-campo-modo") || "texto";

    if (modo === "texto" || modo === "enlace") {
      nodo.textContent = valor;
    }
    if ((modo === "enlace" || modo === "solo-href") && /^https:\/\//.test(valor)) {
      nodo.setAttribute("href", valor);
    }
  }

  var tienda = typeof datos.tiendaUrl === "string" ? datos.tiendaUrl.trim() : "";
  var hayTienda = /^https:\/\//.test(tienda);
  ["texto-sin-cobro", "sin-cobro"].forEach(function (id) {
    var nodo = document.getElementById(id);
    if (nodo) nodo.hidden = hayTienda;
  });
  ["texto-con-cobro", "con-cobro"].forEach(function (id) {
    var nodo = document.getElementById(id);
    if (nodo) nodo.hidden = !hayTienda;
  });

  var copiar = document.getElementById("copiar-ip");
  if (copiar) {
    if (datos.hostname) {
      copiar.textContent = "Copiar " + datos.hostname;
    }
    copiar.addEventListener("click", function () {
      var ip = datos.hostname || copiar.textContent.replace(/^Copiar\s+/, "");
      var aviso = document.getElementById("copiado");
      var mostrar = function () {
        if (aviso) {
          aviso.hidden = false;
        }
      };
      var porArea = function () {
        var area = document.createElement("textarea");
        area.value = ip;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.top = "0";
        area.style.left = "0";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.focus();
        area.select();
        var ok = false;
        try {
          ok = document.execCommand("copy");
        } catch (error) {
          ok = false;
        }
        document.body.removeChild(area);
        if (ok) {
          mostrar();
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ip).then(mostrar).catch(porArea);
      } else {
        porArea();
      }
    });
  }

})();
