from conduit.engine.adapters.registry import AdapterRegistry
print("Starting discovery...")
all_adapters = AdapterRegistry.list_all()
print("Discovered:", all_adapters)
