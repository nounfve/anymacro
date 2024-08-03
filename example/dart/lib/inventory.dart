import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

sealed class InventoryEvent {}

final class AddItemEvent extends InventoryEvent {
  final String item;
  AddItemEvent({required this.item});
}

// @anyMacro EVENT_ONE_PROP(AddItemMacro,Inventory,String,Item)
final class AddItemMacroEvent extends InventoryEvent {
  final String Item;
  AddItemMacroEvent({required this.Item});
}
// @anyMacro EVENT_ONE_PROP(AddItemMacro, Inventory, String, Item)~

class InventoryState extends Equatable {
  final List<String> items;
  const InventoryState({
    required this.items,
  });
  InventoryState.initial()
      : this(
          items: [],
        );

  InventoryState copyWith({
    List<String>? items,
  }) {
    return InventoryState(
      items: items ?? this.items,
    );
  }

  @override
  List<Object?> get props => [items];
}

class InventoryBloc extends Bloc<InventoryEvent, InventoryState> {
  void _onAddItemEvent(AddItemEvent event, Emitter<InventoryState> emit) {
    emit(state.copyWith(items: List.of(state.items)..add(event.item)));
  }

  // @anyMacro EVENT_ONE_PROP_HANDLE(AddItemMacro,Inventory,String,Item)
  void _onAddItemMacroEvent(AddItemMacroEvent event, Emitter<InventoryState> emit) 
  // @anyMacro EVENT_ONE_PROP_HANDLE(AddItemMacro, Inventory, String, Item)~
  {
    emit(state.copyWith(items: List.of(state.items)..add(event.Item)));
  }

  InventoryBloc() : super(InventoryState.initial()) {
    on<AddItemEvent>(_onAddItemEvent);
    // @anyMacro EVENT_ONE_PROP_REGISTER(AddItemMacro,Inventory,String,Item)
    on<AddItemMacroEvent>(_onAddItemMacroEvent);
    // @anyMacro EVENT_ONE_PROP_REGISTER(AddItemMacro, Inventory, String, Item)~
  }
}
