import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

sealed class BNameEvent {}

class BNameState extends Equatable {
  final List<String> items;
  const BNameState({
    required this.items,
  });
  BNameState.initial()
      : this(
          items: [],
        );

  BNameState copyWith({
    List<String>? items,
  }) {
    return BNameState(
      items: items ?? this.items,
    );
  }

  @override
  List<Object?> get props => [items];
}

typedef pType=String;

// @anyMacro EVENT_ONE_PROP(eName,BName,pType,pName)=
final class eNameEvent extends BNameEvent {
  final pType pName;
  eNameEvent({required this.pName});
}
// @anyMacro EVENT_ONE_PROP(eName,BName,pType,pName)~

class BNameBloc extends Bloc<BNameEvent, BNameState> {
  // @anyMacro EVENT_ONE_PROP_HANDLE(eName,BName,pType,pName)=
  void _oneNameEvent(eNameEvent event, Emitter<BNameState> emit) 
  // @anyMacro EVENT_ONE_PROP_HANDLE(eName,BName,pType,pName)~
  {
    emit(state.copyWith(items: List.of(state.items)..add(event.pName)));
  }

  BNameBloc() : super(BNameState.initial()) {
    // @anyMacro EVENT_ONE_PROP_REGISTER(eName,BName,pType,pName)=
    on<eNameEvent>(_oneNameEvent);
    // @anyMacro EVENT_ONE_PROP_REGISTER(eName,BName,pType,pName)~
  }
}
