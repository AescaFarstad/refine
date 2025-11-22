class Technology {

    public id: string;
    public name: string;
    public exec: Function;
    public description: string;
    public subName: string;
	public x: number;
    public y: number;
    public viewData:any;

    constructor(id:string, name:string, subName:string, x:number, y:number, exec:Function) {
        this.id = id;
        this.name = name;
        this.subName = subName;
		this.x = x;
		this.y = y;
        this.exec = exec;
        this.viewData = {};
    }
}  