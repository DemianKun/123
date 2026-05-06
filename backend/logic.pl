% --- BASE DE CONOCIMIENTOS: RECETAS Y REQUISITOS ---
% formato: ingrediente_receta(ID_Receta, Ingrediente, Cantidad_Requerida_kg).

% Receta 1: Hamburguesa Especial (id: r1)
ingrediente_receta(r1, carne, 0.200).
ingrediente_receta(r1, pan, 0.050).
ingrediente_receta(r1, queso, 0.030).

% Receta 2: Ensalada César (id: r2)
ingrediente_receta(r2, lechuga, 0.150).
ingrediente_receta(r2, pollo, 0.100).
ingrediente_receta(r2, aderezo, 0.050).

% Receta 3: Tacos al Pastor (id: r3)
ingrediente_receta(r3, cerdo, 0.250).
ingrediente_receta(r3, tortilla, 0.100).
ingrediente_receta(r3, pina, 0.050).

% --- HECHOS DINÁMICOS: INVENTARIO ACTUAL ---
% Estos hechos serán insertados/actualizados dinámicamente desde Python
% formato: stock_actual(Ingrediente, Cantidad_Disponible_kg).
% (Nota: se usa asserta/retract en tiempo de ejecución, aquí se dejan comentados como ejemplo)
:- dynamic stock_actual/2.
:- dynamic caducidad/2.

% Ejemplo (será sobreescrito por Python):
% stock_actual(carne, 5.0).
% stock_actual(pan, 2.0).
% stock_actual(queso, 1.0).

% --- REGLAS ---

% Regla para verificar si hay suficiente stock de UN ingrediente específico para una receta
tiene_ingrediente_suficiente(Receta, Ingrediente) :-
    ingrediente_receta(Receta, Ingrediente, CantidadReq),
    stock_actual(Ingrediente, CantidadDisp),
    CantidadDisp >= CantidadReq.

% Regla para encontrar algún ingrediente faltante para una receta
ingrediente_faltante(Receta, Ingrediente) :-
    ingrediente_receta(Receta, Ingrediente, CantidadReq),
    ( \+ stock_actual(Ingrediente, _) ; 
      (stock_actual(Ingrediente, CantidadDisp), CantidadDisp < CantidadReq) ).

% Regla principal: Una receta se puede preparar si NO tiene ningún ingrediente faltante
puede_preparar(Receta) :-
    ingrediente_receta(Receta, _, _), % Verificar que la receta exista
    \+ ingrediente_faltante(Receta, _).

% Regla para listar todas las recetas que se pueden preparar actualmente
recetas_disponibles(ListaRecetas) :-
    findall(R, puede_preparar(R), ListaConDuplicados),
    sort(ListaConDuplicados, ListaRecetas).

% --- IA MEJORADA: PRIORIZACIÓN POR CADUCIDAD ---
% Encuentra el ingrediente con la caducidad más próxima de una receta
min_caducidad_receta(Receta, MinDias) :-
    findall(Dias, (ingrediente_receta(Receta, Ing, _), caducidad(Ing, Dias)), ListaDias),
    min_list(ListaDias, MinDias).

% Calcula la prioridad (menor días = mayor prioridad. Usamos Dias como key para sort)
receta_prioridad(Receta, Prioridad-Receta) :-
    puede_preparar(Receta),
    min_caducidad_receta(Receta, Prioridad).

% Lista de recetas priorizadas (las que tienen ingredientes que caducan antes van primero)
recetas_prioritarias(RecetasOrdenadas) :-
    findall(P, receta_prioridad(_, P), ListaPrioridades),
    keysort(ListaPrioridades, ListaOrdenadaKeys), % Ordena ascendente por key (días)
    pairs_values(ListaOrdenadaKeys, RecetasOrdenadas).
