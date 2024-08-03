FROM baseImage

# @anyMacro INSTALL_PYTHON(PACKAGE_MANAGER, _PYTHPN_VERSION)=
RUN PACKAGE_MANAGER update -y &&\
  PACKAGE_MANAGER install -y python_PYTHPN_VERSION python_PYTHPN_VERSION-pip &&\
  python_PYTHPN_VERSION-pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
# @anyMacro INSTALL_PYTHON(PACKAGE_MANAGER, _PYTHPN_VERSION)~