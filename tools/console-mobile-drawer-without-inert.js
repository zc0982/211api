// Run before the app checks for native inert support.
Reflect.deleteProperty(HTMLElement.prototype, 'inert')
