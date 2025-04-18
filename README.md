# PlutoOS ISO Installer Generation

This repo contains the necessary tools and sources to build the PlutoOS Installer ISO that can be used to install PlutoOS on real hardware!

```
sudo pacman -Syu nodejs npm archiso wget arch-install-scripts
./compile.sh
````


# Docker build (experimental)
docker-buildx is required. Shoutout docker 🗣️🗣️

```bash
docker buildx create --name plutobuilder --use
docker buildx inspect --bootstrap
docker buildx build --output "type=local,dest=./artifacts,src=/app/PlutoInstallerScript/out" .
```
