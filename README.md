# Gestor de Pozo

Aplicación web para gestionar un pozo común y balances entre jugadores de forma sencilla y transparente. Ideal para juegos de cartas o mesa.

## Funcionalidades

- **Gestión de Jugadores**: Agregar y eliminar participantes.
- **Control del Pozo**: El pozo se calcula automáticamente en base a los saldos de los jugadores. Si la suma de los jugadores es negativa (deuda), el pozo es positivo (dinero disponible).
- **Transacciones Rápidas**:
  - **Pagar (-)**: Un jugador paga al pozo o transfiere a otro jugador.
  - **Cobrar (+)**: Un jugador retira del pozo o recibe de otro jugador (solo si hay fondos suficientes).
- **Modo Móvil**: Diseño optimizado para celulares, con tarjetas compactas y controles táctiles.
- **Persistencia**: Los datos se guardan automáticamente en el dispositivo.

## Uso

1. Agrega los nombres de los jugadores.
2. Usa "Todos al Pozo" para realizar cobros generales (ej. entrada inicial).
3. Usa los botones **(-)** y **(+)** en cada tarjeta para registrar pagos o cobros individuales.
4. El botón "Reiniciar Todo" borra los datos y comienza una nueva sesión.
