Avoid defensive programming.
Assume lib items by id always exist. You can use ! to silence linter in such situations.
No optional fields in lib item definitions. The raw data may omit stuff, but when parsed, all fields must be initialized with defaults.
Avoid casting (x as any) if the type is known and the property exists.