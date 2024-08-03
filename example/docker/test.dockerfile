FROM baseImage

# @anyMacro INSTALL_PYTHON(dnf,3)

# @anyMacro INSTALL_PYTHON(yum,2)
RUN yum update -y &&\
  yum install -y python2 python2-pip &&\
  python2-pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
# @anyMacro INSTALL_PYTHON(yum, 2)~
