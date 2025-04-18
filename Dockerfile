FROM archlinux

LABEL maintainer="Vince R <vince@77z.dev>"

RUN pacman-key --init && \
    pacman-key --populate archlinux && \
    pacman -Syu --noconfirm

RUN pacman -S --noconfirm arch-install-scripts archiso nodejs npm wget

RUN npm i -g terser postject

WORKDIR /app

COPY . /app


WORKDIR /app/PlutoInstallerScript

# compile command line installer
RUN npm install && \
    node build.js && \
    terser dist/bundle.js > dist/minifiedBundle.js && \
    wget https://nodejs.org/dist/v23.11.0/node-v23.11.0-linux-x64.tar.xz && \
    tar -xf node-v23.11.0-linux-x64.tar.xz && \
    cp node-v23.11.0-linux-x64/bin/node installPluto && \
    node --experimental-sea-config sea-config.json && \
    npx postject installPluto NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 && \
    mkdir out && \
    mv ./installPluto ./out
#    mkdir -p ../isoconfig/airootfs/usr/bin && \
#    cp ./installPluto ../isoconfig/airootfs/usr/bin

WORKDIR /app

# Make ISO image
# RUN --security=insecure mkarchiso -v -w /tmp/work_dir -o ./output ./isoconfig
