# anymacro
a proof of concept language independent preprocessor

## about
this project is inspired by preprocessor of `C/Cpp` compiling tool chains,
more specificly, the function-like `#define` macros.
What it does is simply replace some part of string from defination with calling arguments,
then insert it into the calling file. 

## purpose
take this python code as a example:
```
# a client that does some communacation with a REST api
class User:
  def fetchItems() -> Dict[str,Any]:
    # fectch from api endpoint
    pass
  
  def handleItems(json :Dict[str,Any]) -> str:
    # handle result from fetch and determine what to do
    pass
  
  def doAction(action :str) -> None:
    # actrual do the action
    pass
	
# which typically used like this:
  # ...
  user :User = userFromSomeWhere
  items = user.fetchItems()
  action = user.handleItems(action)
  user.doAction(action)
```
Now imagine there are tons of other methods implmented:
```
class User:
  # ...
  def fetchFriends() -> Dict[str,Any]:
    pass
  def handleFriends(json :Dict[str,Any]) -> str:
    pass
  # ...
```
and they all used in the same pattern with the only difference of method names:
```
  user :User = userFromSomeWhere
  friends = user.fetchFriends()
  action = user.handleFriends(action)
  user.doAction(action)
```
What I used to do is manually copy the code snippet and change the symbol, then wrap it into another method:
```
class User:
  # ...
  def fetchAndHandleFriends(self) -> None:
  	friends = self.fetchFriends()
  	action = self.handleFriends(action)
  	self.doAction(action)
```
Gradually, I find this approach really exhausting and troublesome.It's almost impossible to find it before unit test when you forget to change one of the symbol name. So I want to find a more civil way to do it , that I can simplly write a one-linear, like:
```
@anyMacro FETCH_AND_HANDLE(Friends)
```
which can automaticly expand to a snippet like above.

## basic usage

### defination files
since anymacro implmented as a side-piece language, it doesn't has a **first level** file extension. 
Instead, defination files should match the pattern of `*.anymacro.*`, where the two asterisks `*` representing the file name and ext-name for the file you wish to use these macros.  
***e.g.*** `one.anymacro.dockerfile` for `one.dockerfile`  
  
additionally, definations in `index.anymacro.*` file can be used by any file in its directory **and child directories** with same ext-name.  
***e.g.*** `index.anymacro.dockerfile` for `two.dockerfile`, `three/four.dockerfile`  

### syntax
A defination of a macro look like below:
```
  // @anyMacro MACRO_NAME(MACRO_ARG_ONE,MACRO_ARG_TWO)=
  macro body is "MACRO_ARG_ONE and MACRO_ARG_TWO"
  // @anyMacro MACRO_NAME(MACRO_ARG_ONE,MACRO_ARG_TWO)~
``` 
It has three parts, the first line is `DefineHeadTag`, the last line is `DefineCloseTag`, what's in between is `DefineBody`.
In order to keep anymacro syntax out of the pasing of the main language, there tend to be a comment starter token before keyword `@anyMacro`,thus, in `DefineHeadTag` and `DefineCloseTag` line, anything before `@anyMacro` would be ignored.  
  
A calling of a macro is very similar to `DefineHeadTag` or `DefineCloseTag`, simply replace **macro arguments** with desired string,then drop the trailing `=` or `~`, like:
```
  // @anyMacro MACRO_NAME(Hello,world)
```
to expand this macro, press `ctrl + .` (or whatever method to trigger VSCode **Code Action** menu), there should be a `Quick Fix Action`, which will expand the macro to:
```
  // @anyMacro MACRO_NAME(Hello,world)
	macro body is "Hello and world"
  // @anyMacro MACRO_NAME(Hello,world)~

```

**please refer to [**example**](example/README.md) to more details.

### running example

this project is base on the official language server sample at  
https://github.com/microsoft/vscode-extension-samples/tree/main/lsp-sample  
running method is still same with base sample:
>- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
>- Open VS Code on this folder.
>- Press Ctrl+Shift+B to start compiling the client and server in [watch mode](https://code.visualstudio.com/docs/editor/tasks#:~:text=The%20first%20entry%20executes,the%20HelloWorld.js%20file.).
>- Switch to the Run and Debug View in the Sidebar (Ctrl+Shift+D).
>- Select `Launch Client` from the drop down (if it is not already).
>- Press ▷ to run the launch config (F5).
