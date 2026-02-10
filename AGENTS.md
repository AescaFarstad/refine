Avoid defensive programming. Fail fast. Let null references happen if input data has integrity problems.
You can silence linter, but don't silence errors.
Assume lib items by id always exist. You can use ! to silence linter in such situations.
No optional fields in lib item definitions. The raw data may omit stuff, but when parsed, all fields must be initialized with defaults.
Avoid casting (x as any) if the type is known and the property exists.
Save compatibility is not an issue unless explicitly stated. If you need to do so, make breaking changes with no regards to backwards compatibility.
