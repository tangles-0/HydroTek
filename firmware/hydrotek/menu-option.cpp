/* file: menu-option.cpp */

#include "Arduino.h"
#include "menu-option.h"

MenuOption::MenuOption() {
  _pos = 0;
  _title = "";
  _systemName = "";
  _type = "int";
  _defaultVal = 0;
  _maxVal = 0;
  _minVal = 0;
  _showInMenu = true;
  _saveInFlash = true;
  _setDefaultCurrentVal();
}

MenuOption::MenuOption(int pos, String title, String systemName, String type, float maxVal, float minVal, bool showInMenu, bool saveInFlash) {
  Init(pos, title, systemName, type, maxVal, minVal, showInMenu, saveInFlash);
}

void MenuOption::Init(int pos, String title, String systemName, String type, float maxVal, float minVal, bool showInMenu, bool saveInFlash) {
  _pos = pos;
  _title = title;
  _systemName = systemName;
  _type = type;
  _defaultVal = maxVal;
  _maxVal = maxVal;
  _minVal = minVal;
  _showInMenu = showInMenu;
  _saveInFlash = saveInFlash;
  _setDefaultCurrentVal();
}

void MenuOption::_setDefaultCurrentVal() {
  if (_type == "bool") {
    _boolVal = _defaultVal >= 1;
  } else if (_type == "int") {
    _intVal = int(_defaultVal);
  } else if (_type == "float") {
    _floatVal = _defaultVal;
  }
}

void MenuOption::adjustVal(bool increment) {
  if (_type == "bool") {
    _boolVal = !_boolVal;
  }
  else if (_type == "int") {
    if (increment) {
      _intVal++;
      if (_intVal > int(_maxVal)) {
        _intVal = int(_minVal);
      }
    } else {
      _intVal--;
      if (_intVal < int(_minVal)) {
        _intVal = int(_maxVal);
      }
    }
  }
  else if (_type == "float") {
    if (increment) {
      _floatVal = _floatVal + 0.5;
      if (_floatVal > _maxVal) {
        _floatVal = _minVal;
      }
    } else {
      _floatVal = _floatVal - 0.5;
      if (_floatVal < _minVal) {
        _floatVal = _maxVal;
      }
    }
  }
}

int MenuOption::pos() {
  return _pos;
}
String MenuOption::title() {
  return _title;
}
String MenuOption::getSysName() {
  return _systemName;
}
String MenuOption::getType() {
  return _type;
}
float MenuOption::defaultVal() {
  return _defaultVal;
}
void MenuOption::setBoolVal(bool value) {
  _boolVal = value;
}
void MenuOption::setIntVal(int value) {
  _intVal = value;
}
void MenuOption::setFloatVal(float value) {
  _floatVal = value;
}
bool MenuOption::boolVal() {
  return _boolVal;
}
int MenuOption::intVal() {
  return _intVal;
}
float MenuOption::floatVal() {
  return _floatVal;
}
bool MenuOption::showInMenu() {
  return _showInMenu;
}
bool MenuOption::saveInFlash() {
  return _saveInFlash;
}