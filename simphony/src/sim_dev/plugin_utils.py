import importlib
from importlib.metadata import entry_points

def plugin_getattr(moduleName: str, pluginName: str):
    # discover entry points under 'simphony.actors'
    print(moduleName)
    eps = entry_points(group=moduleName)
    plugin = next((ep for ep in eps if ep.name == pluginName), None)

    if plugin is None:
        raise AttributeError(f'module {moduleName} has no attribute {pluginName}')
    
    # load and cache the plugin module
    module = importlib.import_module(plugin.value)

    # inject it into the current module's namespace so future lookups are faster
    import sys
    full_name = f'{moduleName}.{pluginName}'
    print(full_name)
    sys.modules[full_name] = module
    print(module)
    print(dir(module))

    return module